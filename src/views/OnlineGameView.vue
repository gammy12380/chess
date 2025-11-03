<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { Square } from 'chess.js'

import ChessBoard from '@/components/ChessBoard.vue'
import GameResultModal from '@/components/GameResultModal.vue'
import PromotionPicker from '@/components/PromotionPicker.vue'
import { PROMOTION_ORDER, type PromotionPiece } from '@/constants/pieces'
import { useChessStore } from '@/stores/chess'
import { supabase } from '@/utils/supabase'
import { getClientId } from '@/utils/clientId'

type RoomStatus = 'waiting' | 'playing' | 'finished'

type RoomSummary = {
  id: string
  name: string | null
  status: RoomStatus | null
  owner_id: string | null
}

type RoomPlayer = {
  id: number
  nickname: string | null
  role: string | null
  user_id: string | null
  created_at: string
}

type GameStateRow = {
  id: number
  room_id: string
  fen: string | null
  turn: 'w' | 'b' | null
  last_move: { from?: string | null; to?: string | null; san?: string | null } | null
}

type LastMoveRecord = {
  from: Square
  to: Square
  san?: string
}

type RpcErrorPayload = {
  message?: string
  code?: string | null
  details?: string | null
}

const route = useRoute()
const router = useRouter()
const roomIdParam = computed(() => route.params.roomId as string | undefined)
const clientId = getClientId()
const AUTO_JOIN_LOCK_KEY = 'onlineLobby:autoJoinLock'

const chessStore = useChessStore()
const {
  turnLabel,
  statusMessage,
  isGameOver,
  showResultModal,
  finalResultMessage,
  pendingPromotion,
  history,
  turnColor,
  isSetupComplete,
  mode,
} = storeToRefs(chessStore)

const { dismissResult, promotePawn, loadFromState, exportState, setAllowedMoveColor, reset } =
  chessStore

const promotionOptions = computed<PromotionPiece[]>(() => {
  if (!pendingPromotion.value) {
    return []
  }
  const available = new Set(
    pendingPromotion.value.moves
      .map((move) => move.promotion)
      .filter((value): value is PromotionPiece => Boolean(value)),
  )
  return PROMOTION_ORDER.filter((type) => available.has(type))
})
const promotionColor = computed(() => pendingPromotion.value?.color ?? 'w')

const room = ref<RoomSummary | null>(null)
const players = ref<RoomPlayer[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const syncError = ref<string | null>(null)
const syncing = ref(false)
const leaving = ref(false)
const leaveError = ref<string | null>(null)
const suppressSync = ref(false)
const hasForcedExit = ref(false)
let realtimeChannel: RealtimeChannel | null = null
const playerState = ref<'in_game' | 'waiting'>('waiting')
// 卸載時不再主動呼叫離開/重置 RPC，以避免使用者只是重新整理就導致房間被解散

const statusLabels: Record<RoomStatus, string> = {
  waiting: '等待中',
  playing: '對局中',
  finished: '已結束',
}

const localPlayer = computed(
  () => players.value.find((entry) => entry.user_id === clientId) ?? null,
)
const opponentPlayer = computed(
  () => players.value.find((entry) => entry.user_id && entry.user_id !== clientId) ?? null,
)

const localDisplayName = computed(() => localPlayer.value?.nickname || '你')
const opponentDisplayName = computed(() => opponentPlayer.value?.nickname || '等待玩家')

const localColor = computed<'w' | 'b' | null>(() => {
  const currentPlayer = localPlayer.value
  if (!currentPlayer || !room.value) {
    return null
  }

  const role = (currentPlayer.role || '').toLowerCase()
  if (room.value.owner_id && room.value.owner_id === currentPlayer.user_id) {
    return 'w'
  }
  if (role === 'owner' || role === 'host') {
    return 'w'
  }
  return 'b'
})

const isPlayersTurn = computed(() => {
  if (!localColor.value) {
    return false
  }
  return turnColor.value === localColor.value
})

const hasEnoughPlayers = computed(() => players.value.length >= 2)
const roomStatusLabel = computed(() =>
  room.value?.status ? (statusLabels[room.value.status] ?? room.value.status) : '未知',
)

watch(
  localColor,
  (color) => {
    setAllowedMoveColor(color ?? 'both')
  },
  { immediate: true },
)

watch(
  () => history.value.length,
  async (length, previousLength) => {
    if (suppressSync.value) {
      return
    }
    if (!roomIdParam.value) {
      return
    }
    if (length <= previousLength) {
      return
    }
    if (!localPlayer.value) {
      return
    }
    if (hasForcedExit.value) {
      return
    }
    await pushStateToServer()
  },
)

function translateRpcMessage(message?: string, fallback = '操作失敗，請稍後再試。') {
  if (!message) {
    return fallback
  }

  const upper = message.toUpperCase()
  switch (upper) {
    case 'ROOM_NOT_FOUND':
      return '房間不存在或已被移除。'
    case 'NOT_IN_ROOM':
      return '你尚未加入此房間。'
    case 'ALREADY_OWNER':
      return '你是房主，無法執行此操作。'
    default:
      return fallback
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

function normalizeLastMove(row: GameStateRow): LastMoveRecord | null {
  const payload = row.last_move
  if (!payload?.from || !payload?.to) {
    return null
  }

  return {
    from: String(payload.from).toLowerCase() as Square,
    to: String(payload.to).toLowerCase() as Square,
    san: payload.san ?? undefined,
  }
}

async function applyRemoteState(row: GameStateRow) {
  if (!row.fen) {
    return
  }
  suppressSync.value = true
  try {
    const normalizedMove = normalizeLastMove(row)
    loadFromState({
      fen: row.fen,
      lastMove: normalizedMove,
    })
    isSetupComplete.value = true
  } finally {
    await nextTick()
    suppressSync.value = false
  }
}

async function fetchRoomSummary() {
  if (!roomIdParam.value) {
    return
  }
  const { data, error } = await supabase
    .from('rooms')
    .select('id, name, status, owner_id')
    .eq('id', roomIdParam.value)
    .maybeSingle()
  if (error) {
    throw error
  }
  room.value = data as RoomSummary | null
}

async function fetchPlayers(options: { silent?: boolean } = {}) {
  if (!roomIdParam.value) {
    return
  }
  const { data, error } = await supabase
    .from('room_players')
    .select('id, nickname, role, user_id, created_at')
    .eq('room_id', roomIdParam.value)
    .order('created_at', { ascending: true })
  if (error) {
    if (!options.silent) {
      throw error
    }
    console.error('Failed to fetch room players', error)
    return
  }
  players.value = (data as RoomPlayer[] | null) ?? []
}

async function fetchGameState() {
  if (!roomIdParam.value) {
    return
  }
  const { data, error } = await supabase
    .from('game_states')
    .select('id, room_id, fen, turn, last_move')
    .eq('room_id', roomIdParam.value)
    .maybeSingle()
  if (error) {
    throw error
  }
  if (!data) {
    reset({ triggerAi: false })
    isSetupComplete.value = false
    return
  }

  const row = data as GameStateRow
  if (room.value?.status !== 'playing') {
    reset({ triggerAi: false })
    isSetupComplete.value = false
    return
  }

  await applyRemoteState(row)
}

async function pushStateToServer() {
  if (!roomIdParam.value) {
    return
  }
  syncing.value = true
  syncError.value = null
  try {
    const snapshot = exportState()
    const { error } = await supabase.rpc('sync_game_state', {
      p_client_id: clientId,
      p_room_id: roomIdParam.value,
      p_fen: snapshot.fen,
      p_turn: snapshot.turn,
      p_last_move: snapshot.lastMove ? { ...snapshot.lastMove } : null,
    })

    if (error) {
      throw error
    }
  } catch (error) {
    console.error('Failed to sync game state', error)
    syncError.value = '同步棋局失敗，請稍後再試。'
  } finally {
    syncing.value = false
  }
}

async function setupRealtimeListeners() {
  if (!roomIdParam.value) {
    return
  }
  if (realtimeChannel) {
    await supabase.removeChannel(realtimeChannel)
    realtimeChannel = null
  }

  const channel = supabase
    .channel(`online-game-${roomIdParam.value}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'game_states',
        filter: `room_id=eq.${roomIdParam.value}`,
      },
      async (payload: RealtimePostgresChangesPayload<GameStateRow>) => {
        const newState = (payload.new as GameStateRow | null) ?? null
        if (newState) {
          await applyRemoteState(newState)
        }
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'room_players',
        filter: `room_id=eq.${roomIdParam.value}`,
      },
      () => {
        void fetchPlayers({ silent: true })
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${roomIdParam.value}`,
      },
      (payload: RealtimePostgresChangesPayload<RoomSummary>) => {
        if (payload.eventType === 'DELETE') {
          room.value = null
          return
        }
        const updatedRoom = (payload.new as RoomSummary | null) ?? null
        if (updatedRoom) {
          room.value = updatedRoom
        }
      },
    )

  channel.subscribe((status) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.error('Realtime channel issue', status)
    }
  })

  realtimeChannel = channel
}

async function clearGameState() {
  if (!roomIdParam.value) {
    return
  }

  try {
    const { error } = await supabase.from('game_states').delete().eq('room_id', roomIdParam.value)

    if (error) {
      const { error: updateError } = await supabase
        .from('game_states')
        .update({ fen: null, turn: null, last_move: null })
        .eq('room_id', roomIdParam.value)

      if (updateError) {
        throw updateError
      }
    }
  } catch (error) {
    console.error('Failed to clear game state', error)
  }
}

async function resetRoomToWaiting() {
  if (!roomIdParam.value) {
    return
  }
  try {
    let didReset = false

    const { error } = await supabase.rpc('reset_room_to_waiting', {
      p_client_id: clientId,
      p_room_id: roomIdParam.value,
    })
    if (error) {
      console.error('Failed to reset room via RPC', error)
    } else {
      didReset = true
    }

    if (!didReset) {
      const { error: updateError } = await supabase
        .from('rooms')
        .update({ status: 'waiting' })
        .eq('id', roomIdParam.value)
        .neq('status', 'waiting')

      if (updateError) {
        throw updateError
      }
      didReset = true
    }

    if (didReset) {
      await clearGameState()
      if (room.value) {
        room.value = { ...room.value, status: 'waiting' }
      }
    }
  } catch (error) {
    console.error('Failed to reset room to waiting', error)
  }
}

async function markPlayerState(state: 'in_game' | 'waiting') {
  if (!roomIdParam.value) {
    return
  }
  if (playerState.value === state) {
    return
  }

  const isOwner = room.value?.owner_id === clientId
  const baseRole = isOwner ? 'owner' : 'player'
  const targetRole = state === 'in_game' ? `${baseRole}_in_game` : baseRole

  try {
    const { error } = await supabase
      .from('room_players')
      .update({ role: targetRole })
      .eq('room_id', roomIdParam.value)
      .eq('user_id', clientId)

    if (error) {
      throw error
    }

    playerState.value = state
  } catch (error) {
    console.error('Failed to update player state', error)
  }
}

async function initialize() {
  if (!roomIdParam.value) {
    loadError.value = '無效的房間代碼。'
    loading.value = false
    return
  }

  try {
    reset({ triggerAi: false })
    await fetchRoomSummary()
    if (!room.value) {
      loadError.value = '找不到房間，可能已被移除。'
      return
    }

    await Promise.all([fetchPlayers(), fetchGameState()])
    await markPlayerState('in_game')
    await setupRealtimeListeners()
  } catch (error) {
    console.error('Failed to initialize online game', error)
    loadError.value = '初始化線上對戰失敗，請稍後重試。'
  } finally {
    loading.value = false
  }
}

async function handleLeaveGame() {
  if (!roomIdParam.value) {
    return
  }

  leaving.value = true
  leaveError.value = null
  hasForcedExit.value = true

  try {
    void markPlayerState('waiting')
    const { error } = await supabase.rpc('leave_room', {
      p_client_id: clientId,
      p_room_id: roomIdParam.value,
    })

    if (error) {
      throw error
    }

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(AUTO_JOIN_LOCK_KEY, roomIdParam.value)
    }

    await router.push({ name: 'online' })
  } catch (error) {
    console.error('Failed to leave room', error)
    leaveError.value = resolveSupabaseError(error, '離開房間失敗，請稍候再試。')
  } finally {
    leaving.value = false
  }
}

function handleResultClose() {
  dismissResult()
}

async function handleResultRestart() {
  if (!roomIdParam.value) {
    dismissResult()
    await router.push({ name: 'online' })
    return
  }

  try {
    dismissResult()
    await markPlayerState('waiting')
    const { error } = await supabase.rpc('reset_room_to_waiting', {
      p_client_id: clientId,
      p_room_id: roomIdParam.value,
    })

    if (error) {
      throw error
    }
  } catch (error) {
    console.error('Failed to reset room', error)
  } finally {
    await router.push({ name: 'online', query: { focus: roomIdParam.value } })
  }
}

function isSpectator() {
  return !localPlayer.value
}

function forceExit(reason: 'room-dissolved' | 'opponent-left' | 'removed') {
  if (hasForcedExit.value) {
    return
  }
  hasForcedExit.value = true
  setAllowedMoveColor('both')
  reset({ triggerAi: false })
  void markPlayerState('waiting')
  if (reason === 'opponent-left') {
    void resetRoomToWaiting()
  }
  const blockRoomId = roomIdParam.value
  const query = blockRoomId ? { notice: reason, block: blockRoomId } : { notice: reason }
  if (blockRoomId && typeof window !== 'undefined') {
    window.sessionStorage.setItem(AUTO_JOIN_LOCK_KEY, blockRoomId)
  }
  void router.push({ name: 'online', query })
}

watch(
  () => ({
    loading: loading.value,
    roomExists: Boolean(room.value),
    status: room.value?.status ?? null,
    localMember: Boolean(localPlayer.value),
    playerCount: players.value.length,
  }),
  (snapshot) => {
    if (snapshot.loading || hasForcedExit.value) {
      return
    }

    if (!snapshot.roomExists) {
      forceExit('room-dissolved')
      return
    }

    if (!snapshot.localMember) {
      forceExit('removed')
      return
    }

    if (snapshot.playerCount < 2) {
      forceExit('opponent-left')
    }
  },
  { deep: false },
)

onMounted(() => {
  isSetupComplete.value = false
  setAllowedMoveColor('both')
  // 強制線上對戰使用「雙人對戰」模式，避免本地 AI 在此頁面被觸發
  mode.value = 'pvp'
  void initialize()
})

onBeforeUnmount(() => {
  setAllowedMoveColor('both')
  void markPlayerState('waiting')
  if (realtimeChannel) {
    void supabase.removeChannel(realtimeChannel)
    realtimeChannel = null
  }
  isSetupComplete.value = false
  // 清理卸載監聽器
  // 不註冊 unload 處理器，因此無需移除
})
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-slate-100">
    <div class="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 lg:flex-row lg:items-start">
      <section class="flex-1 space-y-6">
        <header class="space-y-3 rounded-2xl border border-slate-800/60 bg-slate-900/60 p-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 class="text-xl font-semibold text-white">
                {{ room?.name || '對戰房間' }}
              </h1>
              <p class="text-xs text-slate-400">狀態：{{ roomStatusLabel }}</p>
            </div>
            <button
              type="button"
              class="rounded-md border border-slate-700/60 px-3 py-1 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="leaving"
              @click="handleLeaveGame"
            >
              {{ leaving ? '處理中...' : '返回大廳' }}
            </button>
          </div>
          <div class="grid gap-3 text-sm text-slate-300 md:grid-cols-2">
            <div class="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
              <p class="text-xs uppercase tracking-[0.22em] text-slate-400">你</p>
              <p class="text-lg font-semibold text-white">{{ localDisplayName }}</p>
              <p class="text-xs text-slate-400">
                你執棋：{{ localColor === 'w' ? '白方' : localColor === 'b' ? '黑方' : '未指定' }}
              </p>
            </div>
            <div class="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
              <p class="text-xs uppercase tracking-[0.22em] text-slate-400">對手</p>
              <p class="text-lg font-semibold text-white">{{ opponentDisplayName }}</p>
              <p class="text-xs text-slate-400">
                {{ hasEnoughPlayers ? '已加入對戰' : '等待玩家加入' }}
              </p>
            </div>
          </div>
          <p
            v-if="loadError"
            class="rounded-md border border-rose-400/60 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
          >
            {{ loadError }}
          </p>
          <p
            v-else-if="syncError"
            class="rounded-md border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
          >
            {{ syncError }}
          </p>
          <p
            v-else-if="!hasEnoughPlayers"
            class="rounded-md border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
          >
            等待另一位玩家加入後即可開始對局。
          </p>
          <p
            v-else-if="room?.status === 'waiting'"
            class="rounded-md border border-emerald-400/60 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200"
          >
            房主已準備好，可隨時開始對局。
          </p>
          <p v-else class="text-xs text-slate-400">
            {{ isPlayersTurn ? '輪到你走棋。' : '等待對手落子。' }}
          </p>
          <p v-if="leaveError" class="text-xs text-rose-300">{{ leaveError }}</p>
        </header>

        <div
          v-if="loading"
          class="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-10 text-center text-sm text-slate-300"
        >
          正在載入棋局...
        </div>
        <div
          v-else-if="loadError"
          class="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-10 text-center text-sm text-rose-300"
        >
          {{ loadError }}
        </div>
        <div v-else class="space-y-6">
          <div class="relative">
            <ChessBoard />
            <div
              v-if="isSpectator()"
              class="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-slate-900/40 text-sm text-slate-300 backdrop-blur-sm"
            >
              目前為觀戰模式，無法操作棋子。
            </div>
          </div>
          <p v-if="syncing" class="text-xs text-slate-400">同步更新中...</p>
          <p class="text-sm text-slate-300">
            輪到：<span class="font-semibold text-white">{{ turnLabel }}</span>
          </p>
          <p v-if="statusMessage" class="text-sm text-amber-300">{{ statusMessage }}</p>
          <p v-else-if="isGameOver" class="text-sm text-amber-300">
            對局結束，請與對手協調是否再戰。
          </p>
        </div>
      </section>

      <aside
        class="w-full max-w-xs space-y-4 rounded-2xl border border-slate-800/60 bg-slate-900/60 p-5 text-sm text-slate-200"
      >
        <h2 class="text-lg font-semibold text-white">房間玩家</h2>
        <ul class="space-y-2">
          <li
            v-for="player in players"
            :key="player.id"
            class="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-2 text-xs"
          >
            <span>{{ player.nickname || '匿名玩家' }}</span>
            <span class="text-slate-400">
              {{ player.user_id === room?.owner_id ? '房主' : '玩家' }}
            </span>
          </li>
        </ul>
        <div
          class="rounded-lg border border-slate-700/50 bg-slate-800/40 px-3 py-2 text-xs text-slate-400"
        >
          <p>提示：</p>
          <ul class="list-disc space-y-1 pl-5">
            <li v-if="isSpectator()">你目前以觀戰身分進入，無法操作棋子。</li>
            <li v-else>僅能操作分配給自己的顏色，非法操作會被忽略。</li>
            <li>離開房間會自動結束你的連線，如需重賽請回到大廳。</li>
          </ul>
        </div>
      </aside>
    </div>
    <GameResultModal
      :open="showResultModal"
      :message="finalResultMessage"
      :status="statusMessage"
      confirm-label="返回房間"
      @close="handleResultClose"
      @restart="handleResultRestart"
    />
    <PromotionPicker
      :open="Boolean(pendingPromotion)"
      :color="promotionColor"
      :options="promotionOptions"
      @select="promotePawn"
    />
  </div>
</template>
