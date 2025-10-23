import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/play/local',
      name: 'local',
      component: () => import('@/views/LocalGameView.vue'),
    },
    {
      path: '/play/ai',
      name: 'ai',
      component: () => import('@/views/AiGameView.vue'),
    },
    {
      path: '/play/online',
      name: 'online',
      component: () => import('@/views/OnlineLobbyView.vue'),
    },
    {
      path: '/play/online/:roomId',
      name: 'online-game',
      component: () => import('@/views/OnlineGameView.vue'),
      props: true,
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

export default router
