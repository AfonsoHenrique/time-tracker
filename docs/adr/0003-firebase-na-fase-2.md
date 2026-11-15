# 0003. Firebase para sincronização e login na fase 2

- **Status**: Proposto
- **Data**: 2026-11-08

## Contexto

Na fase 2, os registros precisam aparecer no Mac e no Android. O app de ponto precisa funcionar offline e sincronizar depois.

## Decisão (proposta)

Usar Firebase: Firestore com cache offline e login com Google. Um botão importa para a nuvem os dados locais existentes, usando o formato do backup JSON.

## Alternativas consideradas

- **Supabase**: Postgres completo, mas o modo offline teria de ser feito à mão, e projetos gratuitos pausam após uma semana sem uso.

## Consequências

- Plano gratuito sobra para um usuário.
- `src/db/` ganha uma implementação Firestore com a mesma interface.
