// src/lib/anthropic.ts
// Eén bron van waarheid voor de Anthropic-client en modelkeuze.
// Modelwissel = vanaf nu één regel hier (i.p.v. in elke route).

import Anthropic from '@anthropic-ai/sdk';

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const MODEL = 'claude-sonnet-4-6'; // standaard, klantgerichte generatie
export const FAST_MODEL = 'claude-haiku-4-5-20251001'; // extractie/classificatie, 5x goedkoper

/** Pak alle tekst uit een Anthropic-response. */
export function textOf(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

/** Strip codeblok-fences en parse JSON. */
export function parseJSON<T>(text: string): T {
  return JSON.parse(text.replace(/```json|```/g, '').trim()) as T;
}

/** Tokenverbruik uit een response, voor de credits-administratie. */
export function usageOf(message: Anthropic.Messages.Message) {
  return {
    inputTokens: message.usage?.input_tokens ?? 0,
    outputTokens: message.usage?.output_tokens ?? 0,
    webSearches: message.usage?.server_tool_use?.web_search_requests ?? 0,
  };
}
