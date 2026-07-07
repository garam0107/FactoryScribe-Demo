import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import enInventory from './locales/en/inventory.json'
import enMain from './locales/en/main.json'
import enOrders from './locales/en/orders.json'
import enSidebar from './locales/en/sidebar.json'
import koInventory from './locales/ko/inventory.json'
import koMain from './locales/ko/main.json'
import koOrders from './locales/ko/orders.json'
import koSidebar from './locales/ko/sidebar.json'
import viInventory from './locales/vi/inventory.json'
import viMain from './locales/vi/main.json'
import viOrders from './locales/vi/orders.json'
import viSidebar from './locales/vi/sidebar.json'

export const supportedLanguages = [
  { code: 'ko', label: '\uD55C\uAD6D\uC5B4' },
  { code: 'en', label: 'English' },
  { code: 'vi', label: 'Ti\u1EBFng Vi\u1EC7t' },
] as const

export type SupportedLanguage = (typeof supportedLanguages)[number]['code']

export const i18nNamespaces = ['sidebar', 'main', 'orders', 'inventory'] as const

i18n.use(initReactI18next).init({
  resources: {
    ko: {
      sidebar: koSidebar,
      main: koMain,
      orders: koOrders,
      inventory: koInventory,
    },
    en: {
      sidebar: enSidebar,
      main: enMain,
      orders: enOrders,
      inventory: enInventory,
    },
    vi: {
      sidebar: viSidebar,
      main: viMain,
      orders: viOrders,
      inventory: viInventory,
    },
  },
  lng: localStorage.getItem('factoryscribe-language') || 'ko',
  fallbackLng: 'ko',
  ns: i18nNamespaces,
  defaultNS: 'main',
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
