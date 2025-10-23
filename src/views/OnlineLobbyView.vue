<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

import { supabase } from '@/utils/supabase'
import { getClientId } from '@/utils/clientId'

type RoomStatus = 'waiting' | 'playing' | 'finished'

type RoomSummary = {
  id: string
  name: string | null
  status: RoomStatus | null
  owner_id: string | null
  created_at: string
  playerCount: number
}

type RoomRow = {
  id: string
  name: string | null
  status: RoomStatus | null
  owner_id: string | null
  created_at: string
  room_players: Array<{ count: number | null }> | { count: number | null } | null
}

type RoomPlayer = {
  id: number
  nickname: string | null
  role: string | null
  user_id: string | null
  created_at: string
}

type RpcErrorPayload = {
  message?: string
  code?: string | null
  details?: string | null
}

const clientId = getClientId()
const router = useRouter()
const route = useRoute()

const AUTO_JOIN_LOCK_KEY = 'onlineLobby:autoJoinLock'
const initialLockRoomId =
  typeof window !== 'undefined' ? window.sessionStorage.getItem(AUTO_JOIN_LOCK_KEY) : null

let lobbyChannel: RealtimeChannel | null = null

const rooms = ref<RoomSummary[]>([])
const roomsLoading = ref(false)
const roomsError = ref<string | null>(null)

const selectedRoom = ref<RoomSummary | null>(null)

const roomPlayers = ref<RoomPlayer[]>([])
const roomPlayersLoading = ref(false)
const roomPlayersError = ref<string | null>(null)

const membershipRoomId = ref<string | null>(null)

const createForm = reactive({
  name: '',
  nickname: '',
})
const createLoading = ref(false)
const createError = ref<string | null>(null)
const createSuccess = ref<string | null>(null)
const joinNickname = ref('')
const joinLoading = ref(false)
const joinError = ref<string | null>(null)
const joinSuccess = ref<string | null>(null)

const leaveLoading = ref(false)
const leaveError = ref<string | null>(null)
const leaveSuccess = ref<string | null>(null)

const startLoading = ref(false)
const startError = ref<string | null>(null)
const startSuccess = ref<string | null>(null)
const hasNavigatedToGame = ref(false)
const lobbyNotice = ref<string | null>(null)
const focusRoomId = ref<string | null>(null)
const suppressAutoJoin = ref(Boolean(initialLockRoomId))
const autoJoinLockRoomId = ref<string | null>(initialLockRoomId)
let autoJoinEvaluationInFlight = false
let autoJoinEvaluationPending = false

const noticeMessages: Record<string, string> = {
  'opponent-left': '對手已離開，棋局已結束並返回大廳。',
  'room-dissolved': '房主已解散房間，已返回大廳。',
  removed: '你已被移出房間，已返回大廳。',
}

let noticeTimer: ReturnType<typeof setTimeout> | null = null

function showLobbyNotice(message: string) {
  lobbyNotice.value = message
  if (noticeTimer) {
    clearTimeout(noticeTimer)
  }
  noticeTimer = setTimeout(() => {
    lobbyNotice.value = null
    noticeTimer = null
  }, 5000)
}

function dismissLobbyNotice() {
  lobbyNotice.value = null
  if (noticeTimer) {
    clearTimeout(noticeTimer)
    noticeTimer = null
  }
}

function clearNoticeQuery() {
  if (!('notice' in route.query) && !('block' in route.query)) {
    return
  }
  const nextQuery = { ...route.query }
  delete nextQuery.notice
  delete nextQuery.block
  void router.replace({ query: nextQuery })
}

function clearFocusQuery() {
  if (!('focus' in route.query)) {
    return
  }
  const nextQuery = { ...route.query }
  delete nextQuery.focus
  void router.replace({ query: nextQuery })
}

function updateAutoJoinLock(roomId: string | null) {
  autoJoinLockRoomId.value = roomId
  if (typeof window === 'undefined') {
    return
  }
  if (roomId) {
    window.sessionStorage.setItem(AUTO_JOIN_LOCK_KEY, roomId)
  } else {
    window.sessionStorage.removeItem(AUTO_JOIN_LOCK_KEY)
  }
}

const statusLabels: Record<string, string> = {
  waiting: '等待中',
  playing: '對局中',
  finished: '已結束',
}

const ownedRoom = computed(() => rooms.value.find((room) => room.owner_id === clientId) ?? null)
const canCreateRoom = computed(() => ownedRoom.value === null)
const ownedRoomReminder = computed(() =>
  ownedRoom.value
    ? `你目前已建立房間「${ownedRoom.value.name || '未命名房間'}」，請先離開後再建立新房間。`
    : '',
)
const isOwnerOfSelectedRoom = computed(() =>
  Boolean(selectedRoom.value && selectedRoom.value.owner_id === clientId),
)
const isMemberOfSelectedRoom = computed(() =>
  roomPlayers.value.some((player) => player.user_id === clientId),
)

const hasOngoingGame = computed(() => {
  if (!isRoomEffectivelyPlaying(selectedRoom.value, roomPlayers.value.length)) {
    return false
  }
  return roomPlayers.value.some((player) => (player.role ?? '').toLowerCase().includes('in_game'))
})

const canStartGame = computed(() => {
  if (!selectedRoom.value) {
    return false
  }
  if (!isOwnerOfSelectedRoom.value) {
    return false
  }
  if (isRoomEffectivelyPlaying(selectedRoom.value, roomPlayers.value.length)) {
    return false
  }
  return roomPlayers.value.length >= 2
})

const startGameHint = computed(() => {
  if (!selectedRoom.value) {
    return '請先選擇房間。'
  }
  if (!isOwnerOfSelectedRoom.value) {
    return '只有房主可以開始對戰。'
  }
  if (isRoomEffectivelyPlaying(selectedRoom.value, roomPlayers.value.length)) {
    return '對戰仍尚未結束，請等待雙方返回房間。'
  }
  if ((selectedRoom.value.status ?? null) === 'playing') {
    return '上一局已結束，請等待所有玩家回到房間後即可重新開始。'
  }
  if ((selectedRoom.value.status ?? null) === 'finished') {
    return '上一局已結束，確認玩家就緒後即可重新開始。'
  }
  if (roomPlayers.value.length < 2) {
    return '等待至少兩名玩家加入。'
  }
  return '所有玩家已就緒，可開始對戰。'
})
const activeRoomStatus = computed(() =>
  selectedRoom.value
    ? resolveStatusLabel(selectedRoom.value.status, roomPlayers.value.length)
    : '—',
)

const membershipRoom = computed<RoomSummary | null>(() =>
  membershipRoomId.value
    ? (rooms.value.find((room) => room.id === membershipRoomId.value) ?? null)
    : null,
)

const hasMembershipConflict = computed(() => {
  if (!membershipRoomId.value) {
    return false
  }
  if (!selectedRoom.value) {
    return true
  }
  return membershipRoomId.value !== selectedRoom.value.id
})

function isRoomEffectivelyPlaying(room: RoomSummary | null, playersCount?: number) {
  if (!room) {
    return false
  }
  const count = typeof playersCount === 'number' ? playersCount : room.playerCount
  return (room.status ?? null) === 'playing' && count >= 2
}

function resolveStatusLabel(status: string | null, playerCount?: number) {
  const normalizedStatus =
    status === 'playing' && typeof playerCount === 'number' && playerCount < 2 ? 'waiting' : status
  return statusLabels[normalizedStatus ?? 'waiting'] ?? normalizedStatus ?? '未知'
}

function translateRpcMessage(message?: string, fallback = '操作失敗，請稍後再試。') {
  if (!message) {
    return fallback
  }

  const upper = message.toUpperCase()
  switch (upper) {
    case 'OWNER_ALREADY_HAS_ROOM':
      return '你已經擁有房間，請先離開原房間。'
    case 'ROOM_NOT_FOUND':
      return '房間不存在或已被移除。'
    case 'ALREADY_IN_ROOM':
      return '你已在此房間中。'
    case 'ALREADY_OWNER':
      return '你是房主，無需再次加入。'
    case 'ROOM_FULL':
      return '房間人數已滿。'
    case 'NOT_IN_ROOM':
      return '你尚未加入該房間。'
    case 'ROOM_NOT_READY':
      return '房間尚未就緒，請確認已有足夠玩家加入。'
    case 'GAME_ALREADY_ACTIVE':
      return '對戰已經開始。'
    case 'NOT_ROOM_OWNER':
      return '只有房主可以執行此操作。'
    default:
      if (upper.includes('DUPLICATE KEY') || upper.includes('UNIQUE CONSTRAINT')) {
        return '操作失敗：資料已存在或與現有紀錄衝突。'
      }
      return fallback
  }
}

async function handleStartGame() {
  if (!selectedRoom.value) {
    startError.value = '請先選擇房間。'
    return
  }

  startLoading.value = true
  startError.value = null
  startSuccess.value = null

  try {
    if ((selectedRoom.value.status ?? null) !== 'waiting') {
      await ensureRoomReadyForStart(selectedRoom.value.id)
    }
    updateAutoJoinLock(null)
    const { error } = await supabase.rpc('start_game', {
      p_client_id: clientId,
      p_room_id: selectedRoom.value.id,
    })

    if (error) {
      throw error
    }

    startSuccess.value = '對戰已開始，正在進入棋局...'

    hasNavigatedToGame.value = true
    await fetchRooms()
    await fetchRoomPlayers(selectedRoom.value.id)
    await router.push({ name: 'online-game', params: { roomId: selectedRoom.value.id } })
  } catch (error) {
    console.error('Failed to start game', error)
    startError.value = resolveSupabaseError(error, '無法開始對戰，請稍後再試。')
  } finally {
    startLoading.value = false
  }
}

async function ensureRoomReadyForStart(roomId: string) {
  try {
    const { error } = await supabase.rpc('reset_room_to_waiting', {
      p_client_id: clientId,
      p_room_id: roomId,
    })

    if (!error) {
      return
    }

    const { error: updateError } = await supabase
      .from('rooms')
      .update({ status: 'waiting' })
      .eq('id', roomId)
      .neq('status', 'waiting')

    if (updateError) {
      console.error('Failed to normalize room status before start', updateError)
    }
  } catch (error) {
    console.error('Failed to prepare room for restart', error)
  }
}

function queueAutoJoinEvaluation() {
  if (autoJoinEvaluationInFlight) {
    autoJoinEvaluationPending = true
    return
  }

  autoJoinEvaluationInFlight = true
  autoJoinEvaluationPending = false
  void evaluateMembershipAutoJoin()
}

async function evaluateMembershipAutoJoin() {
  try {
    if (!membershipRoomId.value) {
      if (suppressAutoJoin.value) {
        suppressAutoJoin.value = false
      }
      if (autoJoinLockRoomId.value) {
        updateAutoJoinLock(null)
      }
      return
    }

    const targetRoom = rooms.value.find((room) => room.id === membershipRoomId.value) ?? null
    if (!targetRoom) {
      if (suppressAutoJoin.value) {
        suppressAutoJoin.value = false
      }
      if (autoJoinLockRoomId.value) {
        updateAutoJoinLock(null)
      }
      return
    }

    if (autoJoinLockRoomId.value && autoJoinLockRoomId.value === targetRoom.id) {
      if (targetRoom.status === 'playing') {
        return
      }
      updateAutoJoinLock(null)
    }

    const shouldAutoJoin = await isRoomActiveForAutoJoin(targetRoom)

    if (!shouldAutoJoin) {
      if (suppressAutoJoin.value) {
        suppressAutoJoin.value = false
      }
      return
    }

    if (suppressAutoJoin.value) {
      return
    }
    if (hasNavigatedToGame.value) {
      return
    }

    hasNavigatedToGame.value = true
    await router.push({ name: 'online-game', params: { roomId: targetRoom.id } })
  } finally {
    autoJoinEvaluationInFlight = false
    if (autoJoinEvaluationPending) {
      autoJoinEvaluationPending = false
      queueAutoJoinEvaluation()
    }
  }
}

async function isRoomActiveForAutoJoin(room: RoomSummary) {
  if (!isRoomEffectivelyPlaying(room)) {
    return false
  }

  try {
    const { data, error } = await supabase
      .from('room_players')
      .select('role')
      .eq('room_id', room.id)

    if (error) {
      console.error('Failed to check room in-game state', error)
      return room.status === 'playing'
    }

    const players = (data as Array<{ role: string | null }> | null) ?? []
    return players.some((entry) => (entry.role ?? '').toLowerCase().includes('in_game'))
  } catch (error) {
    console.error('Failed to determine room active state', error)
    return room.status === 'playing'
  }
}

function resolveSupabaseError(error: unknown, fallback: string) {
  const payload = error as RpcErrorPayload | undefined
  if (payload?.message) {
    return translateRpcMessage(payload.message, fallback)
  }
  if (payload?.code === '23505') {
    return '操作失敗：資料已存在或與現有紀錄衝突。'
  }
  return fallback
}

function extractRoomId(record: Record<string, unknown> | null | undefined) {
  if (!record || typeof record !== 'object') {
    return null
  }
  if (!('room_id' in record)) {
    return null
  }

  const value = (record as { room_id?: unknown }).room_id
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number') {
    return String(value)
  }

  return null
}

function extractUserId(record: Record<string, unknown> | null | undefined) {
  if (!record || typeof record !== 'object') {
    return null
  }
  if (!('user_id' in record)) {
    return null
  }

  const value = (record as { user_id?: unknown }).user_id
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number') {
    return String(value)
  }

  return null
}

async function loadMembership() {
  try {
    const { data, error } = await supabase
      .from('room_players')
      .select('room_id')
      .eq('user_id', clientId)
      .limit(1)

    if (error) {
      throw error
    }

    const joinedRoomIdRaw = (data as Array<{ room_id: unknown }> | null)?.[0]?.room_id ?? null
    if (typeof joinedRoomIdRaw === 'string') {
      membershipRoomId.value = joinedRoomIdRaw
      return
    }
    if (typeof joinedRoomIdRaw === 'number') {
      membershipRoomId.value = String(joinedRoomIdRaw)
      return
    }

    if (ownedRoom.value) {
      membershipRoomId.value = ownedRoom.value.id
    } else {
      membershipRoomId.value = null
    }
  } catch (error) {
    console.error('Failed to load current membership', error)
  }
}

async function fetchRooms(options: { silent?: boolean } = {}) {
  const { silent = false } = options
  const shouldToggleLoading = !silent

  if (shouldToggleLoading) {
    roomsLoading.value = true
  }
  roomsError.value = null

  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('id, name, status, owner_id, created_at, room_players(count)')
      .order('created_at', { ascending: true })

    if (error) {
      throw error
    }

    const mapped = ((data as RoomRow[] | null) ?? []).map((room) => {
      const countSource = Array.isArray(room.room_players)
        ? room.room_players[0]
        : room.room_players
      return {
        id: room.id,
        name: room.name,
        status: room.status,
        owner_id: room.owner_id,
        created_at: room.created_at,
        playerCount: Number(countSource?.count ?? 0),
      } as RoomSummary
    })

    rooms.value = mapped

    if (mapped.length === 0) {
      selectedRoom.value = null
    } else if (!selectedRoom.value) {
      const firstRoom = mapped[0] ?? null
      selectedRoom.value = firstRoom
    } else {
      const updated = mapped.find((room) => room.id === selectedRoom.value?.id) ?? null
      const fallbackRoom = mapped[0] ?? null
      selectedRoom.value = updated ?? fallbackRoom
    }

    if (!canCreateRoom.value && selectedRoom.value && selectedRoom.value.owner_id !== clientId) {
      selectedRoom.value = ownedRoom.value ?? selectedRoom.value
    }

    if (focusRoomId.value) {
      const focusTarget = mapped.find((room) => room.id === focusRoomId.value) ?? null
      if (focusTarget) {
        selectedRoom.value = focusTarget
        focusRoomId.value = null
        clearFocusQuery()
      }
    }

    if (membershipRoomId.value && !rooms.value.some((room) => room.id === membershipRoomId.value)) {
      membershipRoomId.value = ownedRoom.value?.id ?? null
    }
  } catch (error) {
    console.error('Failed to fetch rooms', error)
    roomsError.value = '無法取得房間列表，請稍後再試。'
  } finally {
    if (shouldToggleLoading) {
      roomsLoading.value = false
    }
  }
}

async function fetchRoomPlayers(roomId: string, options: { silent?: boolean } = {}) {
  const { silent = false } = options
  const shouldToggleLoading = !silent

  if (shouldToggleLoading) {
    roomPlayersLoading.value = true
  }
  roomPlayersError.value = null

  try {
    const { data, error } = await supabase
      .from('room_players')
      .select('id, nickname, role, user_id, created_at')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })

    if (error) {
      throw error
    }

    roomPlayers.value = (data as RoomPlayer[] | null) ?? []
  } catch (error) {
    console.error('Failed to fetch room players', error)
    roomPlayersError.value = '無法取得玩家列表。'
    roomPlayers.value = []
  } finally {
    if (shouldToggleLoading) {
      roomPlayersLoading.value = false
    }
  }
}

function coerceToStringId(value: unknown) {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number') {
    return String(value)
  }
  return null
}

function extractRoomPrimaryId(record: Record<string, unknown> | null | undefined) {
  if (!record || typeof record !== 'object') {
    return null
  }
  return coerceToStringId((record as { id?: unknown }).id)
}

function handleRoomsChange(payload: RealtimePostgresChangesPayload<Record<string, unknown>>) {
  const eventType = payload.eventType

  if (eventType === 'DELETE') {
    const removedId = extractRoomPrimaryId(payload.old)
    if (removedId) {
      rooms.value = rooms.value.filter((room) => room.id !== removedId)

      if (selectedRoom.value?.id === removedId) {
        const fallback = rooms.value[0] ?? null
        selectedRoom.value = fallback
        if (fallback) {
          void fetchRoomPlayers(fallback.id, { silent: true })
        } else {
          roomPlayers.value = []
        }
      }

      if (membershipRoomId.value === removedId) {
        membershipRoomId.value = ownedRoom.value?.id ?? null
      }
    }
  }

  void fetchRooms({ silent: true })
}

function handleRoomPlayersChange(payload: RealtimePostgresChangesPayload<Record<string, unknown>>) {
  void fetchRooms({ silent: true })

  const targetRoomId = selectedRoom.value?.id
  if (!targetRoomId) {
    const maybeJoinedRoom = extractRoomId(payload.new)
    const maybeJoinedUser = extractUserId(payload.new)
    if (maybeJoinedUser === clientId && maybeJoinedRoom) {
      membershipRoomId.value = maybeJoinedRoom
    }
    const maybeLeftUser = extractUserId(payload.old)
    if (maybeLeftUser === clientId && !extractUserId(payload.new)) {
      membershipRoomId.value = ownedRoom.value?.id ?? null
    }
    return
  }

  const newRoomId = extractRoomId(payload.new)
  const oldRoomId = extractRoomId(payload.old)
  const newUserId = extractUserId(payload.new)
  const oldUserId = extractUserId(payload.old)

  if (newRoomId === targetRoomId || oldRoomId === targetRoomId) {
    void fetchRoomPlayers(targetRoomId, { silent: true })
  }

  if (newUserId === clientId && newRoomId) {
    membershipRoomId.value = newRoomId
  } else if (oldUserId === clientId && newUserId !== clientId) {
    membershipRoomId.value = ownedRoom.value?.id ?? null
    if (!ownedRoom.value) {
      membershipRoomId.value = null
    }
  }
}

async function setupRealtimeListeners() {
  if (lobbyChannel) {
    await supabase.removeChannel(lobbyChannel)
    lobbyChannel = null
  }

  const channel = supabase
    .channel('online-lobby')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, (payload) =>
      handleRoomsChange(payload),
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players' }, (payload) =>
      handleRoomPlayersChange(payload),
    )

  channel.subscribe((status) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.error('Realtime channel issue', status)
    }
  })

  lobbyChannel = channel
}

watch(
  () => selectedRoom.value?.id,
  (roomId) => {
    joinError.value = null
    joinSuccess.value = null
    startError.value = null
    startSuccess.value = null

    if (roomId) {
      void fetchRoomPlayers(roomId)
    } else {
      roomPlayers.value = []
    }
  },
  { immediate: true },
)

watch(
  () => ownedRoom.value?.id ?? null,
  (ownedId) => {
    if (ownedId) {
      membershipRoomId.value = ownedId
    }
  },
)

watch(
  () => [
    rooms.value.slice(),
    membershipRoomId.value,
    suppressAutoJoin.value,
    autoJoinLockRoomId.value,
  ],
  () => {
    queueAutoJoinEvaluation()
  },
  { deep: true },
)

watch(
  () => route.query.notice,
  (notice) => {
    if (typeof notice !== 'string' || !notice) {
      return
    }
    const message = noticeMessages[notice] ?? '房間已結束，已返回大廳。'
    showLobbyNotice(message)
    suppressAutoJoin.value = true
    const blockValue = route.query.block
    updateAutoJoinLock(typeof blockValue === 'string' ? blockValue : null)
    clearNoticeQuery()
  },
  { immediate: true },
)

watch(
  () => route.query.focus,
  (focus) => {
    if (typeof focus !== 'string' || !focus) {
      focusRoomId.value = null
      return
    }
    focusRoomId.value = focus
    const targetRoom = rooms.value.find((room) => room.id === focus)
    if (targetRoom) {
      selectedRoom.value = targetRoom
      void fetchRoomPlayers(targetRoom.id, { silent: true })
      clearFocusQuery()
      focusRoomId.value = null
    }
  },
  { immediate: true },
)

async function handleCreateRoom() {
  if (!createForm.name.trim()) {
    createError.value = '請輸入房間名稱。'
    return
  }

  createLoading.value = true
  createError.value = null
  createSuccess.value = null

  try {
    const payload: Record<string, unknown> = {
      p_client_id: clientId,
      p_room_name: createForm.name.trim(),
      p_max_players: 2,
    }

    if (createForm.nickname.trim()) {
      payload.p_nickname = createForm.nickname.trim()
    }

    const { data, error } = await supabase.rpc('create_room', payload)

    if (error || !data) {
      throw error ?? new Error('房間建立失敗')
    }

    createSuccess.value = '房間建立成功！'

    if (createForm.nickname.trim()) {
      joinNickname.value = createForm.nickname.trim()
    }

    createForm.name = ''

    await fetchRooms()

    const roomId = (data as { id: string }).id
    selectedRoom.value =
      rooms.value.find((room) => room.id === roomId) ?? selectedRoom.value ?? null

    if (selectedRoom.value) {
      await fetchRoomPlayers(selectedRoom.value.id)
    }

    membershipRoomId.value = roomId
  } catch (error) {
    console.error('Failed to create room', error)
    createError.value = resolveSupabaseError(error, '無法建立房間，請確認權限或稍候再試。')
  } finally {
    createLoading.value = false
  }
}

async function handleJoinRoom() {
  if (!selectedRoom.value) {
    joinError.value = '請先選擇要加入的房間。'
    return
  }

  if (!joinNickname.value.trim()) {
    joinError.value = '請輸入顯示名稱。'
    return
  }

  if (membershipRoomId.value && membershipRoomId.value !== selectedRoom.value.id) {
    joinError.value = '你目前已在其他房間，請先離開後再加入。'
    return
  }

  joinLoading.value = true
  joinError.value = null
  joinSuccess.value = null

  try {
    const { data, error } = await supabase.rpc('join_room', {
      p_client_id: clientId,
      p_room_id: selectedRoom.value.id,
      p_nickname: joinNickname.value.trim(),
    })

    if (error || !data) {
      throw error ?? new Error('加入房間失敗')
    }

    joinSuccess.value = '已成功加入房間。'
    await fetchRooms()
    await fetchRoomPlayers(selectedRoom.value.id)

    membershipRoomId.value = selectedRoom.value.id
  } catch (error) {
    console.error('Failed to join room', error)
    joinError.value = resolveSupabaseError(error, '加入房間失敗，請稍後再嘗試。')
  } finally {
    joinLoading.value = false
  }
}

async function handleLeaveRoom() {
  if (!selectedRoom.value) {
    leaveError.value = '請先選擇房間。'
    return
  }

  leaveLoading.value = true
  leaveError.value = null
  leaveSuccess.value = null

  try {
    const { error } = await supabase.rpc('leave_room', {
      p_client_id: clientId,
      p_room_id: selectedRoom.value.id,
    })

    if (error) {
      throw error
    }

    leaveSuccess.value = selectedRoom.value.owner_id === clientId ? '已解散房間。' : '已離開房間。'

    await fetchRooms()

    if (ownedRoom.value) {
      selectedRoom.value = ownedRoom.value
      await fetchRoomPlayers(ownedRoom.value.id)
    } else {
      selectedRoom.value = null
      roomPlayers.value = []
    }

    if (membershipRoomId.value) {
      const fallbackOwnedId = ownedRoom.value?.id ?? null
      membershipRoomId.value = fallbackOwnedId
    }
  } catch (error) {
    console.error('Failed to leave room', error)
    leaveError.value = resolveSupabaseError(error, '離開房間失敗，請稍候重試。')
  } finally {
    leaveLoading.value = false
  }
}

function goToOwnedRoom() {
  if (!ownedRoom.value) {
    return
  }

  selectedRoom.value = ownedRoom.value
  void fetchRoomPlayers(ownedRoom.value.id)
}

function goToMembershipRoom() {
  if (!membershipRoomId.value) {
    return
  }

  const targetRoom = rooms.value.find((room) => room.id === membershipRoomId.value)
  if (!targetRoom) {
    return
  }

  selectedRoom.value = targetRoom
  void fetchRoomPlayers(targetRoom.id)
}

onMounted(() => {
  void (async () => {
    await fetchRooms()
    await loadMembership()
    await setupRealtimeListeners()
  })()
})

onBeforeUnmount(() => {
  if (noticeTimer) {
    clearTimeout(noticeTimer)
    noticeTimer = null
  }
  if (lobbyChannel) {
    void supabase.removeChannel(lobbyChannel)
    lobbyChannel = null
  }
})
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-slate-100">
    <div class="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 lg:flex-row lg:items-start">
      <section
        class="w-full max-w-md space-y-6 rounded-2xl border border-slate-800/60 bg-slate-900/60 p-6"
      >
        <p
          v-if="lobbyNotice"
          class="rounded-md border border-emerald-400/60 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200"
        >
          <span>{{ lobbyNotice }}</span>
          <button type="button" class="ml-3 underline" @click="dismissLobbyNotice">關閉</button>
        </p>
        <header class="space-y-1">
          <h1 class="text-xl font-semibold text-white">線上大廳</h1>
          <p class="text-sm text-slate-300">建立房間與朋友對戰，或加入現有房間。</p>
        </header>

        <article class="space-y-3 rounded-xl border border-slate-700/60 bg-slate-800/60 p-4">
          <h2 class="text-base font-semibold text-white">建立房間</h2>
          <p v-if="!canCreateRoom" class="text-xs text-amber-300">{{ ownedRoomReminder }}</p>
          <form class="space-y-3" @submit.prevent="handleCreateRoom">
            <div class="space-y-1">
              <label class="text-sm text-slate-300" for="create-room-name">房間名稱</label>
              <input
                id="create-room-name"
                v-model="createForm.name"
                type="text"
                class="w-full rounded-md border border-slate-600/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
                placeholder="輸入房間名稱"
                :disabled="createLoading"
              />
            </div>
            <div class="space-y-1">
              <label class="text-sm text-slate-300" for="create-room-nickname">你的暱稱</label>
              <input
                id="create-room-nickname"
                v-model="createForm.nickname"
                type="text"
                class="w-full rounded-md border border-slate-600/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
                placeholder="建立房間時顯示的名稱"
                :disabled="createLoading"
              />
            </div>
            <button
              type="submit"
              class="w-full rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 focus:outline-none focus-visible:ring focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="createLoading || !canCreateRoom"
            >
              {{ createLoading ? '建立中...' : '建立房間' }}
            </button>
            <p v-if="createError" class="text-sm text-rose-300">{{ createError }}</p>
            <p v-else-if="createSuccess" class="text-sm text-emerald-300">{{ createSuccess }}</p>
          </form>
        </article>

        <article class="space-y-3 rounded-xl border border-slate-700/60 bg-slate-800/60 p-4">
          <h2 class="text-base font-semibold text-white">加入房間</h2>
          <p class="text-xs text-slate-400">先在右側列表選擇房間，再輸入暱稱加入。</p>
          <p
            v-if="hasMembershipConflict"
            class="rounded-md border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
          >
            你目前已在
            <span class="font-semibold text-amber-100">
              {{ membershipRoom?.name || '其他房間' }}
            </span>
            ，請先離開或
            <button type="button" class="underline" @click="goToMembershipRoom">
              切換到該房間
            </button>
            。
          </p>
          <form class="space-y-3" @submit.prevent="handleJoinRoom">
            <div class="space-y-1">
              <label class="text-sm text-slate-300" for="join-nickname">你的暱稱</label>
              <input
                id="join-nickname"
                v-model="joinNickname"
                type="text"
                class="w-full rounded-md border border-slate-600/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
                placeholder="進入房間時顯示的名稱"
                :disabled="joinLoading"
              />
            </div>
            <button
              type="submit"
              class="w-full rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 focus:outline-none focus-visible:ring focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="
                joinLoading ||
                !selectedRoom ||
                isOwnerOfSelectedRoom ||
                isMemberOfSelectedRoom ||
                hasMembershipConflict
              "
            >
              {{ joinLoading ? '加入中...' : '加入房間' }}
            </button>
            <p v-if="joinError" class="text-sm text-rose-300">{{ joinError }}</p>
            <p v-else-if="joinSuccess" class="text-sm text-emerald-300">{{ joinSuccess }}</p>
          </form>
          <div
            v-if="ownedRoom && !isOwnerOfSelectedRoom"
            class="rounded-md border border-emerald-400/60 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200"
          >
            你有自己的房間。
            <button type="button" class="ml-2 underline" @click="goToOwnedRoom">前往房間</button>
          </div>
        </article>

        <article
          v-if="isMemberOfSelectedRoom || isOwnerOfSelectedRoom"
          class="space-y-3 rounded-xl border border-slate-700/60 bg-slate-800/60 p-4"
        >
          <h2 class="text-base font-semibold text-white">離開房間</h2>
          <p class="text-xs text-slate-400">離開後即可加入其他房間或建立新房間。</p>
          <button
            type="button"
            class="w-full rounded-md border border-rose-400/60 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:border-rose-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="leaveLoading"
            @click="handleLeaveRoom"
          >
            {{ leaveLoading ? '處理中...' : isOwnerOfSelectedRoom ? '解散房間' : '離開房間' }}
          </button>
          <p v-if="leaveError" class="text-sm text-rose-300">{{ leaveError }}</p>
          <p v-else-if="leaveSuccess" class="text-sm text-emerald-300">{{ leaveSuccess }}</p>
        </article>
      </section>

      <section class="flex-1 space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-white">房間列表</h2>
            <p class="text-xs text-slate-400">選擇房間以查看詳細資訊。</p>
          </div>
          <button
            v-if="isOwnerOfSelectedRoom"
            type="button"
            class="rounded-md border border-emerald-400/60 px-3 py-1 text-xs font-medium text-emerald-200"
            disabled
          >
            我是房主
          </button>
        </div>

        <div class="space-y-3">
          <p v-if="roomsLoading" class="text-sm text-slate-400">載入房間列表中...</p>
          <p v-else-if="roomsError" class="text-sm text-rose-300">{{ roomsError }}</p>
          <p v-else-if="rooms.length === 0" class="text-sm text-slate-300">目前沒有公開房間。</p>

          <ul v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <li
              v-for="room in rooms"
              :key="room.id"
              :class="[
                'cursor-pointer rounded-xl border border-slate-700/60 bg-slate-800/60 p-4 transition hover:border-emerald-400/60 hover:bg-slate-800',
                selectedRoom?.id === room.id && 'border-emerald-400/70 bg-slate-800',
              ]"
              @click="selectedRoom = room"
            >
              <div class="flex items-center justify-between text-sm font-medium text-white">
                <span>{{ room.name || '未命名房間' }}</span>
                <span
                  class="rounded-full border border-emerald-400/60 px-2 py-0.5 text-xs text-emerald-200"
                >
                  {{ resolveStatusLabel(room.status, room.playerCount) }}
                </span>
              </div>
              <div class="mt-1 text-xs text-slate-300">
                <span>玩家人數：{{ room.playerCount }}</span>
                <span class="ml-3">建立時間：{{ new Date(room.created_at).toLocaleString() }}</span>
              </div>
            </li>
          </ul>
        </div>

        <div
          v-if="selectedRoom"
          class="space-y-4 rounded-2xl border border-slate-700/70 bg-slate-800/60 p-5"
        >
          <header class="space-y-1">
            <h3 class="text-xl font-semibold text-white">
              {{ selectedRoom.name || '未命名房間' }}
            </h3>
            <p class="text-xs text-slate-300">
              狀態：{{ activeRoomStatus }} · 房主：{{
                selectedRoom.owner_id?.slice(0, 8) || '未知'
              }}
            </p>
          </header>

          <section class="space-y-2">
            <h4 class="text-sm font-semibold text-slate-200">已加入的玩家</h4>
            <p v-if="roomPlayersLoading" class="text-xs text-slate-400">載入玩家列表中...</p>
            <p v-else-if="roomPlayersError" class="text-xs text-rose-300">{{ roomPlayersError }}</p>
            <p v-else-if="roomPlayers.length === 0" class="text-xs text-slate-300">
              尚未有玩家加入。
            </p>
            <ul v-else class="space-y-2 text-xs text-slate-200">
              <li
                v-for="player in roomPlayers"
                :key="player.id"
                class="flex items-center justify-between rounded border border-slate-600/40 bg-slate-900/40 px-3 py-2"
              >
                <span>{{ player.nickname || '匿名玩家' }}</span>
                <span class="text-slate-400">
                  <template v-if="(player.role ?? '').includes('owner')">房主</template>
                  <template v-else>玩家</template>
                  <span
                    v-if="
                      isRoomEffectivelyPlaying(selectedRoom, roomPlayers.length) &&
                      (player.role ?? '').toLowerCase().includes('in_game')
                    "
                    class="ml-2 rounded-full border border-amber-400/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-amber-200"
                  >
                    對局中
                  </span>
                </span>
              </li>
            </ul>
          </section>

          <section
            v-if="isOwnerOfSelectedRoom"
            class="space-y-3 rounded-xl border border-slate-700/60 bg-slate-900/40 p-4"
          >
            <h4 class="text-sm font-semibold text-slate-200">房主控制</h4>
            <p
              v-if="hasOngoingGame"
              class="rounded-md border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
            >
              尚有玩家停留在上一局的棋盤畫面，請等待所有玩家返回房間後再開始。
            </p>
            <p class="text-xs text-slate-400">{{ startGameHint }}</p>
            <button
              type="button"
              class="w-full rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 focus:outline-none focus-visible:ring focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="startLoading || !canStartGame"
              @click="handleStartGame"
            >
              {{ startLoading ? '準備中...' : '開始對戰' }}
            </button>
            <p v-if="startError" class="text-xs text-rose-300">{{ startError }}</p>
            <p v-else-if="startSuccess" class="text-xs text-emerald-300">{{ startSuccess }}</p>
          </section>
        </div>
      </section>
    </div>
  </div>
</template>
