/* Seção Destaques da home: confere de novo no navegador, com a data e a hora
   de agora (Recife), se a seleção gerada no build continua valendo.
   O build roda só quando alguém publica; sem isto, um evento que encerrou
   (ou cancelou/esgotou) depois da publicação continuaria em destaque.
   A regra é a mesma do build: selecionarDestaques() em js/render.js. */
import { agoraRecife, selecionarDestaques, destaquesHTML, assinaturaDestaques, MAX_DESTAQUES, acaoCompra, estadoEvento } from './render.js';

export function atualizarDestaques(agora = agoraRecife()) {
  const caixa = document.querySelector('[data-destaques]');
  const el = document.getElementById('tx-dados');
  if (!caixa || !el) return;
  const { eventos = [], categorias = [] } = JSON.parse(el.textContent);
  const hoje = agora.slice(0, 10);
  const lista = selecionarDestaques(eventos, agora);
  const assinatura = assinaturaDestaques(lista, hoje);
  if (assinatura === caixa.dataset.assinatura) return;
  caixa.innerHTML = destaquesHTML(lista, { hoje, categorias });
  caixa.dataset.assinatura = assinatura;
  caixa.classList.toggle('tem-carrossel', lista.slice(0, MAX_DESTAQUES).some(e => e.img && acaoCompra(e, estadoEvento(e, hoje)).href));
}
