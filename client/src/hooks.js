/* ربط React بطبقة البيانات: أي تغيير في البيانات يعيد رسم المكوّنات المشتركة */
import { useSyncExternalStore } from 'react';
import { subscribeData, getDataVersion } from './lib/store.js';
import { routeStore } from './lib/bridge.js';
import { Auth } from './lib/auth.js';

export function useData() { return useSyncExternalStore(subscribeData, getDataVersion); }
export function useRoute() { return useSyncExternalStore(routeStore.subscribe, routeStore.get); }
/** المستخدم الحالي (يتحدّث تلقائيًا) */
export function useUser() { useData(); return Auth.current(); }
