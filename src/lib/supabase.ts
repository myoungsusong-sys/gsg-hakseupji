import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// 환경변수 없으면 null → 앱은 localStorage 단독 모드로 동작
export const supabase = url && key ? createClient(url, key) : null
export const SUPABASE_ON = !!supabase
