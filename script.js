/* =======================
   BATALHA POKÉMON — CORE
   ======================= */

const API = 'https://pokeapi.co/api/v2';

/* Tradução + classes de cor por tipo */
const TYPE_MAP = {
  bug:{pt:'Inseto',css:'type-bug'}, dark:{pt:'Sombrio',css:'type-dark'},
  dragon:{pt:'Dragão',css:'type-dragon'}, electric:{pt:'Elétrico',css:'type-electric'},
  fairy:{pt:'Fada',css:'type-fairy'}, fighting:{pt:'Lutador',css:'type-fighting'},
  fire:{pt:'Fogo',css:'type-fire'}, flying:{pt:'Voador',css:'type-flying'},
  ghost:{pt:'Fantasma',css:'type-ghost'}, grass:{pt:'Planta',css:'type-grass'},
  ground:{pt:'Terrestre',css:'type-ground'}, ice:{pt:'Gelo',css:'type-ice'},
  normal:{pt:'Normal',css:'type-normal'}, poison:{pt:'Venenoso',css:'type-poison'},
  psychic:{pt:'Psíquico',css:'type-psychic'}, rock:{pt:'Pedra',css:'type-rock'},
  steel:{pt:'Aço',css:'type-steel'}, water:{pt:'Água',css:'type-water'},
};

/* Iniciais (primeira fase), ordenados */
const STARTERS = [
  'bulbasaur','charmander','squirtle','pikachu',
  'chikorita','cyndaquil','totodile',
  'treecko','torchic','mudkip',
  'turtwig','chimchar','piplup',
  'snivy','tepig','oshawott',
  'chespin','fennekin','froakie',
  'rowlet','litten','popplio',
  'grookey','scorbunny','sobble',
  'sprigatito','fuecoco','quaxly'
].sort();

/* Estado global */
const state = {
  jogador: null,
  adversario: null,
  golpesJog: [],
  golpesAdv: [],
  lutas: 0,
  vitorias: 0,
  derrotas: 0,
  vitoriasParaEvoluir: 5, // depois 8, depois 12
  hpJogAtual: 0,
  hpAdvAtual: 0,
};

/* ---------- Persistência ---------- */
function salvarEstado(){
  localStorage.setItem('bp_state', JSON.stringify({
    lutas: state.lutas,
    vitorias: state.vitorias,
    derrotas: state.derrotas,
    vitoriasParaEvoluir: state.vitoriasParaEvoluir
  }));
}
function carregarEstado(){
  const raw = localStorage.getItem('bp_state');
  if(!raw) return;
  try{ Object.assign(state, JSON.parse(raw)); }catch{}
}

/* ---------- Util ---------- */
function elSel(sel){ return document.querySelector(sel); }
function titleCase(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function traduzirTipo(t){ return TYPE_MAP[t]?.pt ?? titleCase(t); }
function classeTipo(t){ return TYPE_MAP[t]?.css ?? ''; }

function statsBasicos(pk){
  return {
    hp:  pk.stats.find(s=>s.stat.name==='hp')?.base_stat ?? 0,
    atk: pk.stats.find(s=>s.stat.name==='attack')?.base_stat ?? 0
  };
}

/* ---------- API ---------- */
async function fetchJSON(url){
  const r = await fetch(url);
  if(!r.ok) throw new Error(`Erro na API (${r.status})`);
  return r.json();
}
async function getPokemon(idOrName){
  return fetchJSON(`${API}/pokemon/${String(idOrName).toLowerCase()}`);
}
async function getSpecies(idOrName){
  return fetchJSON(`${API}/pokemon-species/${String(idOrName).toLowerCase()}`);
}
async function getEvolutionChainBySpeciesIdOrName(idOrName){
  const sp = await getSpecies(idOrName);
  return fetchJSON(sp.evolution_chain.url);
}
async function getTypeEffectiveness(typeName){
  return fetchJSON(`${API}/type/${typeName}`);
}
async function getMoveDetail(moveUrl){
  return fetchJSON(moveUrl);
}

/* ---------- UI helpers ---------- */
function atualizarStatsUI(){
  const l = elSel('#stLutas'), v = elSel('#stVitorias'), d = elSel('#stDerrotas'),
        tx = elSel('#stTaxa'), pe = elSel('#stProxEvolucao');
  if(!l) return; // não está na página de jogo
  l.textContent = state.lutas;
  v.textContent = state.vitorias;
  d.textContent = state.derrotas;
  const taxa = state.lutas ? (state.vitorias / state.lutas) : 0;
  tx.textContent = (taxa*100).toFixed(1)+'%';
  pe.textContent = `${state.vitoriasParaEvoluir} vitórias`;
}
function pintarResultado(msg){
  const p = elSel('#painelResultado'); if(p) p.textContent = msg || '';
}
function log(msg){
  const ol = elSel('#logBatalhas'); if(!ol) return;
  const li = document.createElement('li');
  li.textContent = msg;
  ol.prepend(li);
}

/* ========================
   LISTA / BUSCA / FILTROS
   ======================== */
async function carregarListaIniciais(){
  const sel = elSel('#listaIniciais');
  if(!sel) return;
  sel.innerHTML = '';
  STARTERS.forEach(n=>{
    const opt = document.createElement('option');
    opt.value = n;
    opt.textContent = titleCase(n);
    sel.appendChild(opt);
  });
}

function carregarSelectTipos(){
  const sel = elSel('#selectTipo');
  if(!sel) return;
  sel.innerHTML = '<option value="">-- Todos os tipos --</option>';
  Object.keys(TYPE_MAP).forEach(t=>{
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = traduzirTipo(t);
    sel.appendChild(opt);
  });
  sel.addEventListener('change', ()=> filtrarListaPorTipo(sel.value));
}

/* filtra a lista de STARTERS por tipo. vazio => lista completa (alfabética) */
async function filtrarListaPorTipo(tipo){
  const sel = elSel('#listaIniciais');
  if(!sel) return;
  sel.innerHTML = '';
  if(!tipo){
    // volta a lista completa, ordenada
    STARTERS.forEach(n=>{
      const opt = document.createElement('option');
      opt.value = n; opt.textContent = titleCase(n);
      sel.appendChild(opt);
    });
    return;
  }
  // filtra por tipo usando a API (lista pequena, ok)
  for(const n of STARTERS){
    try{
      const pk = await getPokemon(n);
      if(pk.types.some(tt => tt.type.name === tipo)){
        const opt = document.createElement('option');
        opt.value = n; opt.textContent = titleCase(n);
        sel.appendChild(opt);
      }
    }catch{}
  }
}

/* ==================
   CARDS / CONTEÚDOS
   ================== */
function setFoto(node, pk){
  const img = pk.sprites?.other?.['official-artwork']?.front_default || pk.sprites?.front_default;
  node.querySelector('.foto-selo').innerHTML = img
    ? `<img src="${img}" alt="${pk.name}" style="max-width:100%;max-height:100%;border-radius:8px;">`
    : '3x4';
}
function setTipos(node, pk){
  const tipos = pk.types.map(t=>t.type.name);
  node.querySelector('.tag-tipo').textContent = tipos.map(traduzirTipo).join(', ');
  node.className = `poke-card ${classeTipo(tipos[0])}`;
}
async function setForcaFraqueza(node, pk){
  const tipos = pk.types.map(t=>t.type.name);
  const rels = await Promise.all(tipos.map(getTypeEffectiveness));
  const to = new Set(), from = new Set();
  for(const r of rels){
    r.damage_relations.double_damage_to.forEach(x=>to.add(x.name));
    r.damage_relations.double_damage_from.forEach(x=>from.add(x.name));
  }
  node.querySelector('.forcafraca').innerHTML =
    `<strong>Força:</strong> ${[...to].map(traduzirTipo).join(', ') || '—'} | <strong>Fraqueza:</strong> ${[...from].map(traduzirTipo).join(', ') || '—'}`;
}
function listarEvolucoesDaChain(chain){
  const res = [];
  (function walk(n){ res.push(n.species.name); (n.evolves_to||[]).forEach(walk); })(chain.chain);
  return res;
}
async function setEvolucoes(node, pk){
  try{
    const evo = await getEvolutionChainBySpeciesIdOrName(pk.name);
    node.dataset.evoChain = JSON.stringify(evo);
    const nomes = listarEvolucoesDaChain(evo).map(titleCase);
    node.querySelector('.evolucoes').innerHTML =
      `<strong>Evoluções:</strong> ${nomes.join(' → ')} | <strong>Exp. Base:</strong> ${pk.base_experience}`;
  }catch{
    node.querySelector('.evolucoes').textContent = `Evoluções: — | Exp. Base: ${pk.base_experience ?? '—'}`;
  }
}
async function escolher3Golpes(pk){
  const candidatos = [];
  for(const m of pk.moves){
    try{
      const det = await getMoveDetail(m.move.url);
      if(det.power){
        candidatos.push({ name: det.name, power: det.power, type: det.type.name, damage_class: det.damage_class?.name });
      }
    }catch{}
    if(candidatos.length >= 12) break;
  }
  return candidatos.sort(()=>Math.random()-0.5).slice(0,3);
}
function renderGolpes(node, golpes, deQuem){
  const wrap = node.querySelector('.golpes-lista');
  wrap.innerHTML = '';
  golpes.forEach((g,i)=>{
    const b = document.createElement('button');
    b.className = 'golpe-btn '+classeTipo(g.type);
    b.dataset.idx = String(i);
    b.title = `${titleCase(g.name)} — ${traduzirTipo(g.type)} • Power ${g.power}`;
    b.textContent = titleCase(g.name.replaceAll('-', ' '));
    if(deQuem==='adv') b.disabled = true;
    wrap.appendChild(b);
  });
}
async function preencherCard(sel, pk, quem){
  const node = elSel(sel);
  node.classList.remove('vazio');
  node.querySelector('.poke-nome').textContent = titleCase(pk.name);
  setFoto(node, pk);
  setTipos(node, pk);
  const {hp, atk} = statsBasicos(pk);
  node.querySelector('.hp').textContent = hp;
  node.querySelector('.atk').textContent = atk;
  // linha de características gerais
  node.querySelector('.evolucoes').innerHTML =
    `Altura: ${(pk.height/10).toFixed(1)} m | Peso: ${(pk.weight/10).toFixed(1)} kg | Abilities: ${pk.abilities.map(a=>a.ability.name).join(', ')}`;
  await setForcaFraqueza(node, pk);
  await setEvolucoes(node, pk);
  const golpes = await escolher3Golpes(pk);
  renderGolpes(node, golpes, quem==='adv' ? 'adv' : 'jog');
  if(quem==='adv'){ state.golpesAdv = golpes; state.hpAdvAtual = hp; }
  else { state.golpesJog = golpes; state.hpJogAtual = hp; }
}
function limparCardAdversario() {
  const node = elSel('#cardAdversario');
  if (!node) return;
  node.classList.add('vazio');
  node.querySelector('.poke-nome').textContent = 'Adversário';
  node.querySelector('.foto-selo').innerHTML = '3x4';
  node.querySelector('.tag-tipo').textContent = '—';
  node.querySelector('.hp').textContent = '—';
  node.querySelector('.atk').textContent = '—';
  node.querySelector('.forcafraca').textContent = '—';
  node.querySelector('.evolucoes').textContent = '—';
  node.querySelector('.golpes-lista').innerHTML = '';
  state.adversario = null;
  state.golpesAdv = [];
  state.hpAdvAtual = 0;
}

/* ==================
   EQUIVALÊNCIA / IA
   ================== */
function eMesmoTier(a, b){
  // HP/ATK ±15%
  const A = statsBasicos(a), B = statsBasicos(b);
  const hpOk  = Math.abs(A.hp - B.hp) <= A.hp * 0.15;
  const atkOk = Math.abs(A.atk - B.atk) <= A.atk * 0.15;
  return hpOk && atkOk;
}
async function gerarAdversarioEquivalente(refPk){
  for(let i=0;i<25;i++){
    const randId = Math.floor(Math.random()*300)+1;
    try{
      const pk = await getPokemon(randId);
      if(eMesmoTier(refPk, pk)) return pk;
    }catch{}
  }
  return getPokemon(Math.floor(Math.random()*151)+1);
}

/* ===============
   BATALHA / DANO
   =============== */
function rolarDado(){ return Math.floor(Math.random()*6)+1; }
async function efetividade(atkType, defPk){
  const rel = await getTypeEffectiveness(atkType);
  let mult = 1;
  for(const t of defPk.types.map(x=>x.type.name)){
    if(rel.double_damage_to.some(x=>x.name===t)) mult *= 2;
    if(rel.half_damage_to.some(x=>x.name===t))   mult *= 0.5;
    if(rel.no_damage_to.some(x=>x.name===t))     mult *= 0;
  }
  return mult;
}
async function calcularDano(golpe, atacante, defensor, dado){
  const base = golpe.power;
  const mult = await efetividade(golpe.type, defensor);
  const bonus = dado/6; // 1 a 6 vira 0.166.. a 1.0
  const atk = statsBasicos(atacante).atk;
  return Math.max(1, Math.round(base * mult * bonus * (1 + atk/400)));
}

/* ===============
   BOTOES / ESTADO
   =============== */
function atualizarBotoes(est){
  const bL = elSel('#btnLutar'),
        bD = elSel('#btnDado'),
        bDe= elSel('#btnDesistir'),
        bT = elSel('#btnNovoAdversario'),
        bE = elSel('#btnEvoluir');
  if(est==='inicio'){ // antes de começar
    if(bL) bL.disabled = false;
    if(bD) bD.disabled = true;
    if(bDe) bDe.disabled = true;
    if(bT) bT.disabled = true;
    atualizarBotaoEvoluir(); // depende das vitórias
  }
  if(est==='emLuta'){ // batalha rolando
    if(bL) bL.disabled = true;
    if(bD) bD.disabled = false;
    if(bDe) bDe.disabled = false;
    if(bT) bT.disabled = true;
    if(bE) bE.disabled = true; // evolução não durante a luta
  }
  if(est==='fim'){ // terminou a luta
    if(bL) bL.disabled = false;
    if(bD) bD.disabled = true;
    if(bDe) bDe.disabled = true;
    if(bT) bT.disabled = false; // trocar adversário só agora
    atualizarBotaoEvoluir();
  }
}
function atualizarBotaoEvoluir(){
  const btn = elSel('#btnEvoluir');
  if(!btn) return;
  btn.disabled = !(state.vitorias >= state.vitoriasParaEvoluir);
}

/* =================
   EVOLUÇÃO / RAMOS
   ================= */
function opcoesEvolucaoDoAtual(nodeCard, nomeAtual){
  try{
    const evo = JSON.parse(nodeCard.dataset.evoChain || '{}');
    function achar(n){
      if(n.species.name===nomeAtual) return n;
      for(const e of n.evolves_to||[]){
        const achou = achar(e); if(achou) return achou;
      }
      return null;
    }
    const no = achar(evo.chain);
    if(!no) return [];
    return (no.evolves_to||[]).map(e=>e.species.name);
  }catch{ return []; }
}

/* ===================
   UI (PÁGINA: JOGO)
   =================== */
async function escolherJogadorPorNome(nome, primeiraEscolha=false){
  const low = String(nome).toLowerCase();
  // sua regra de primeira escolha só de iniciais — mantenho se usar "primeiraEscolha"
  if(primeiraEscolha && !STARTERS.includes(low)){
    alert('Para a primeira escolha, selecione apenas um Pokémon inicial.');
    return null;
  }
  try{
    const pk = await getPokemon(low);
    state.jogador = pk;
    await preencherCard('#cardJogador', pk, 'jog');
    pintarResultado('Escolha “Lutar” para iniciar a batalha.');
    atualizarBotoes('inicio');
    return pk;
  }catch{
    alert('Pokémon não encontrado.');
    return null;
  }
}

function bindJogo(){
  const primeiraVez = !localStorage.getItem('bp_jah_escolheu');
  carregarEstado();
  atualizarStatsUI();
  atualizarBotaoEvoluir();
  carregarListaIniciais();
  carregarSelectTipos();
  atualizarBotoes('inicio');

  const busca = elSel('#buscaNome');
  const btnAdd = elSel('#btnBuscarPorNome');
  const btnEscolher = elSel('#btnEscolherInicial');
  const sel = elSel('#listaIniciais');

  btnAdd?.addEventListener('click', async ()=>{
    if(!busca.value.trim()) return;
    const ok = await escolherJogadorPorNome(busca.value.trim(), primeiraVez);
    if(ok && primeiraVez){ localStorage.setItem('bp_jah_escolheu','1'); }
  });

  btnEscolher?.addEventListener('click', async ()=>{
    if(!sel.value) return;
    const ok = await escolherJogadorPorNome(sel.value, primeiraVez);
    if(ok && primeiraVez){ localStorage.setItem('bp_jah_escolheu','1'); }
  });

  // Lutar → apenas inicia a luta (gera/adiciona adversário, reseta HP) e desabilita-se
  elSel('#btnLutar')?.addEventListener('click', async ()=>{
    if(!state.jogador) return alert('Escolha seu Pokémon.');
    state.adversario = await gerarAdversarioEquivalente(state.jogador);
    await preencherCard('#cardAdversario', state.adversario, 'adv');
    state.hpJogAtual = statsBasicos(state.jogador).hp;
    state.hpAdvAtual = statsBasicos(state.adversario).hp;
    pintarResultado(`⚔️ A batalha começou contra ${titleCase(state.adversario.name)}!`);
    atualizarBotoes('emLuta');
  });

  // Dado → executa um turno (ataque e contra-ataque); se acabar, limpa card do adversário
  elSel('#btnDado')?.addEventListener('click', async ()=>{
    if(!state.jogador || !state.adversario) return alert('Inicie a luta primeiro.');
    const gJ = state.golpesJog[0] || {power:40,type:'normal',name:'tackle'};
    const gA = state.golpesAdv[0] || {power:40,type:'normal',name:'tackle'};
    const d1 = rolarDado(), d2 = rolarDado();
    const danoJog = await calcularDano(gJ, state.jogador, state.adversario, d1);
    const danoAdv = await calcularDano(gA, state.adversario, state.jogador, d2);
    state.hpAdvAtual = Math.max(0, state.hpAdvAtual - danoJog);
    state.hpJogAtual = Math.max(0, state.hpJogAtual - danoAdv);

    let msg = `${titleCase(state.jogador.name)} causou ${danoJog}, sofreu ${danoAdv}. HP seu: ${state.hpJogAtual} • HP adversário: ${state.hpAdvAtual}`;

    if(state.hpAdvAtual<=0 || state.hpJogAtual<=0){
      state.lutas++;
      if(state.hpAdvAtual<=0 && state.hpJogAtual>0){
        state.vitorias++;
        log(`Vitória sobre ${titleCase(state.adversario.name)} (Dano ${danoJog}, sofreu ${danoAdv}, HP restante ${state.hpJogAtual})`);
        msg = `✅ Vitória sobre ${titleCase(state.adversario.name)}!`;
      }else{
        state.derrotas++;
        log(`Derrota para ${titleCase(state.adversario.name)} (Sofreu ${danoAdv})`);
        msg = `❌ Derrota contra ${titleCase(state.adversario.name)}.`;
      }
      salvarEstado(); atualizarStatsUI(); atualizarBotaoEvoluir();
      limparCardAdversario(); // limpa card do adversário ao término
      atualizarBotoes('fim'); // reabilita “Lutar” e “Trocar adversário”
    }
    pintarResultado(msg);
  });

  // Desistir → só faz sentido durante a luta
  elSel('#btnDesistir')?.addEventListener('click', ()=>{
    if(!state.jogador || !state.adversario) return;
    state.lutas++; state.derrotas++;
    salvarEstado(); atualizarStatsUI();
    log(`Derrota por desistência contra ${titleCase(state.adversario.name)}`);
    pintarResultado('Você desistiu.');
    limparCardAdversario();
    atualizarBotoes('fim');
  });

  // Trocar adversário → após fim da luta, orienta a iniciar novamente
  elSel('#btnNovoAdversario')?.addEventListener('click', ()=>{
    pintarResultado('Use “Lutar” para gerar um novo adversário.');
  });

  // Escolha manual de golpe prioritário (clicando nos botões do card do jogador)
  elSel('#cardJogador')?.addEventListener('click', (ev)=>{
    const btn = ev.target.closest('.golpe-btn');
    if(!btn) return;
    const idx = Number(btn.dataset.idx);
    if(Number.isInteger(idx) && state.golpesJog[idx]){
      const [g] = state.golpesJog.splice(idx,1);
      state.golpesJog.unshift(g);
      renderGolpes(elSel('#cardJogador'), state.golpesJog, 'jog');
      pintarResultado(`Golpe prioritário: ${titleCase(g.name)}.`);
    }
  });

  // Evoluir → habilita só se vitórias suficientes; loga “de… para…”
  elSel('#btnEvoluir')?.addEventListener('click', async ()=>{
    if(!state.jogador) return alert('Escolha seu Pokémon.');
    if(state.vitorias < state.vitoriasParaEvoluir) return;

    const card = elSel('#cardJogador');
    const opcoes = opcoesEvolucaoDoAtual(card, state.jogador.name);
    if(opcoes.length === 0) return alert('Este Pokémon não possui evolução disponível agora.');

    let escolha = opcoes[0];
    if(opcoes.length > 1){
      const tx = 'Opções de evolução:\n' + opcoes.map((n,i)=>`${i+1}) ${titleCase(n)}`).join('\n') + '\n\nDigite o número:';
      const idx = Number(prompt(tx)) - 1;
      if(isNaN(idx) || idx<0 || idx>=opcoes.length) return alert('Opção inválida.');
      escolha = opcoes[idx];
    }

    const nomeAntigo = state.jogador.name;
    state.jogador = await getPokemon(escolha);
    await preencherCard('#cardJogador', state.jogador, 'jog');
    pintarResultado(`🎉 Evoluiu para ${titleCase(escolha)}!`);
    log(`Pokémon evoluiu de ${titleCase(nomeAntigo)} para ${titleCase(escolha)}.`);

    if(state.vitoriasParaEvoluir===5) state.vitoriasParaEvoluir = 8;
    else if(state.vitoriasParaEvoluir===8) state.vitoriasParaEvoluir = 12;
    state.vitorias = 0;
    salvarEstado(); atualizarStatsUI(); atualizarBotaoEvoluir();
  });
}

/* ==========================
   UI (PÁGINA: LISTA/INDEX)
   ========================== */
async function bindLista(){
  // Monta os chips (se existir) e uma lista simples navegável
  const ul = elSel('#ulListaPokemons'); if(!ul) return;
  try{
    const data = await fetchJSON(`${API}/pokemon?limit=300`);
    const todos = data.results.map(x=>x.name);
    function render(lista){ ul.innerHTML = lista.map(n=>`<li>${titleCase(n)}</li>`).join(''); }
    render(todos);
    elSel('#buscaLista')?.addEventListener('input', (e)=>{
      const q = e.target.value.toLowerCase();
      const filtrados = todos.filter(n=>n.includes(q));
      render(filtrados);
    });
  }catch{
    ul.innerHTML = '<li>Falha ao carregar lista.</li>';
  }
}

/* ==============================
   UI (PÁGINA: DOCUMENTAÇÃO/API)
   ============================== */
function resumirPokemon(pk){
  return {
    id: pk.id, name: pk.name, height: pk.height, weight: pk.weight,
    base_experience: pk.base_experience,
    abilities: pk.abilities.map(a=>a.ability.name),
    types: pk.types.map(t=>t.type.name),
    stats: pk.stats.map(s=>({ stat:s.stat.name, base:s.base_stat })),
    moves_count: pk.moves.length,
    sample_moves: pk.moves.slice(0,5).map(m=>m.move.name),
    sprites: {
      front_default: pk.sprites.front_default,
      official_art: pk.sprites?.other?.['official-artwork']?.front_default
    }
  };
}
function resumirSpecies(sp){
  return {
    color: sp.color?.name, growth_rate: sp.growth_rate?.name, habitat: sp.habitat?.name,
    is_baby: sp.is_baby, is_legendary: sp.is_legendary, is_mythical: sp.is_mythical,
    capture_rate: sp.capture_rate, base_happiness: sp.base_happiness,
    egg_groups: sp.egg_groups?.map(x=>x.name),
    evolution_chain_url: sp.evolution_chain?.url
  };
}
function resumirEvoChain(ev){
  function plano(n){ return { name:n.species.name, evolves_to:(n.evolves_to||[]).map(plano) }; }
  return plano(ev.chain);
}
async function bindDoc(){
  const btn = elSel('#btnDocBuscar');
  if(!btn) return;
  btn.addEventListener('click', async ()=>{
    const nome = elSel('#docNome').value.trim().toLowerCase();
    if(!nome) return;
    try{
      const pk = await getPokemon(nome);
      const sp = await getSpecies(nome);
      const ev = await fetchJSON(sp.evolution_chain.url);
      elSel('#prePokemon').textContent = JSON.stringify(resumirPokemon(pk), null, 2);
      elSel('#preSpecies').textContent = JSON.stringify(resumirSpecies(sp), null, 2);
      elSel('#preEvo').textContent = JSON.stringify(resumirEvoChain(ev), null, 2);
    }catch{
      alert('Não foi possível obter dados desse Pokémon.');
    }
  });
}

/* =============
   ENTRADA GERAL
   ============= */
document.addEventListener('DOMContentLoaded', ()=>{
  const path = location.pathname;
  if(path.endsWith('jogo.html')) bindJogo();
  else if(path.endsWith('lista.html')) bindLista();
  else if(path.endsWith('documentacao.html')) bindDoc();
  else {
    // index.html: apenas landing
  }
});
