---
name: Rejet Corp
description: Identidade visual do marketplace de excedentes industriais
colors:
  papel-mineral: "#f1f2ec"
  superficie-clara: "#fafbf7"
  carvao: "#0b0b0b"
  verde-marca: "#2e7d32"
  lima-marca: "#b6ff00"
  lima-acao-home: "#def75b"
  lima-detalhe-home: "#d8f34e"
  lima-interacao-home: "#f0ff9c"
  texto-acao-home: "#141e10"
  texto-home: "#f7f7ec"
  verde-paisagem: "#172e24"
  aco: "#5f6e64"
  texto-painel: "#243127"
  acao-painel: "#a8c686"
typography:
  display:
    fontFamily: "Space Grotesk, IBM Plex Sans, sans-serif"
  body:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
rounded:
  acao-home: "13px"
  painel-sm: "12px"
  painel-md: "18px"
  painel-lg: "26px"
spacing:
  painel-sm: "8px"
  painel-md: "16px"
  painel-lg: "24px"
---

## Overview

A home mostra a passagem do excedente para um novo uso, com paisagem industrial, luz natural e pontos de conexão em lima. O painel usa superfícies claras e hierarquia de informação voltada a catálogo, mensagens e negociações. O modo escuro segue os tokens já existentes.

## Colors

Use os tokens de `src/styles/global.css` e do componente que está sendo alterado. Na home, reserve o lima de ação para a chamada principal e os sinais da rede. No painel, use verde para ações e os tokens semânticos para erro, aviso e sucesso. Combine cor com texto ou ícone em estados importantes.

## Typography

Use Space Grotesk nos títulos de destaque da home e IBM Plex Sans para leitura, formulários e dados. As duas famílias estão empacotadas no projeto.

## Layout

Preserve as cenas em largura ampla na home e ajuste o enquadramento para telas pequenas. Mantenha textos e ações legíveis abaixo das cenas. No painel, reaproveite a estrutura de navegação e dê prioridade aos dados que o usuário precisa comparar.

## Elevation & Depth

A paisagem e as camadas da home criam profundidade. No painel, bordas e diferenças de superfície organizam as áreas. Reserve sombras para sobreposições e componentes que precisam se destacar.

## Components

Reutilize os componentes de `src/components/ui` e os CSS Modules existentes. Preserve os estados de foco, erro, carregamento e desabilitado. Na home, mantenha a entrada industrial, a sequência “Como funciona” e o Ecossistema Conectado como cenas distintas.

## Do's and Don'ts

- Use a marca existente, imagens industriais pertinentes, chamadas concretas e exemplos identificados.
- Reserve a animação para explicar o ciclo dos materiais. Respeite a preferência por movimento reduzido.
- Evite cartões repetidos em seções editoriais, gradientes decorativos e dados de impacto inventados.
