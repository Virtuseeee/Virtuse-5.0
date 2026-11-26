import type { Answer } from './ask'

export interface ChatMsg {
  role: 'user' | 'cfo'
  text: string
  answer?: Answer
}

export interface Chat {
  id: string
  title: string
  msgs: ChatMsg[]
}
