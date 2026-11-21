export const calls: any[] = []
export const q: any[] = []   // 차례로 돌려줄 응답 {text, stop} 또는 Error
export default class Anthropic {
  messages = { create: async (args: any) => {
    calls.push(args)
    const r = q.shift()
    if (r instanceof Error) throw r
    return { content: [{ type: 'text', text: r.text }], stop_reason: r.stop ?? 'end_turn' }
  } }
  constructor(_: any) {}
}
export declare namespace Anthropic { type TextBlock = { type: 'text'; text: string } }
