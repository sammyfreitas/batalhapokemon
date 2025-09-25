/* =======================
   BATALHA POKÉMON — CORE
   ======================= */

// Endpoints base
const API = 'https://pokeapi.co/api/v2';

// Tradução e cores por tipo (nome -> {pt, css})
const TYPE_MAP = {
  bug:       { pt: 'Inseto',     css: 'type-bug' },
  dark:      { pt: 'Sombrio',    css: 'type-dark' },
  dragon:    { pt: 'Dragão',     css: 'type-dragon' },
  electric:  { pt: 'Elétrico',   css: 'type-electric' },
  fairy:     { pt: 'Fada',       css: 'type-fairy' },
  fighting:  { pt: 'Lutador',    css: 'type-fighting' },
  fire:      { pt: 'Fogo',       css: 'type-fire' },
  flying:    { pt: 'Voador',     css: 'type-flying' },
  ghost:     { pt: 'Fantasma',   css: 'type-ghost' },
  grass:     { pt: 'Planta',     css: 'type-grass' },
  ground:    { pt: 'Terrestre',  css: 'type-ground' },
  ice:       { pt: 'Gelo',       css: 'type-ice' },
  normal:    { pt: 'Normal',     css: 'type-normal' },
  poison:    { pt: 'Venenoso',   css: 'type-poison' },
  psychic:   { pt: 'Psíquico',   css: 'type-psychic' },
  rock:      { pt: 'Pedra',      css: 'type-rock' },
  steel:     { pt: 'Aço',        css: 'type-steel' },
  water:     { pt: 'Água',       css: 'type-water' },
};

// Iniciais permitidos na primeira escolha (você pode ajustar essa lista)
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
];

// Estado global (guardado entre páginas via localStorage)
const state = {
  jogador: null,     // objeto Pokémon completo
  adversario: null,  // idem
  golpesJog: [],     // moves detalhados
  golpesAdv: [],
  lutas: 0,
  vitorias: 0,
  derrotas: 0,
  vitoriasParaEvoluir: 5, // 5 -> 8 -> 12 (após cada evolução)
  podeTrocarAdversario: true
};

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
  try{
    const obj = JSON.parse(raw);
    Object.assign(state, obj);
  }catch{}
}

/* ============
   FETCH UTILS
   ============ */
async function fetchJSON(url){
  const r = await fetch(url);
  if(!r.ok) throw new Error(`Erro na API: ${r.status}`);
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
  const evoUrl = sp.evolution_chain.url;
  return fetchJSON(evoUrl);
}
async function getTypeEffectiveness(typeName){
  // Pega damage_relations para calcular forças/fraquezas
  const data = await fetchJSON(`${API}/type/${typeName}`);
  return data.damage_relations;
}
async function getMoveDetail(moveUrl){
  return fetchJSON(moveUrl);
}

/* ==================
   HELPERS DE RENDER
   ================== */
function elSel(sel){ return document.querySelector(sel); }
function cls(node, ...names){ node.classList.remove(...node.classList); names.forEach(n=>node.classList.add(n)); }
function titleCase(s){ return s.charAt(0).toUpperCase() + s.slice(1); }
function traduzirTipo(t){ return TYPE_MAP[t]?.pt ?? titleCase(t); }
function classeTipo(t){ return TYPE_MAP[t]?.css ?? ''; }
function formatPct(x){ return (x*100).toFixed(0)+'%'; }

function atualizarStatsUI(){
  const l = elSel('#stLutas'), v=elSel('#stVitorias'), d=elSel('#stDerrotas'), tx=elSel('#stTaxa'), pe=elSel('#stProxEvolucao');
  if(!l) return; // página não é jogo
  l.textContent = state.lutas;
  v.textContent = state.vitorias;
  d.textContent = state.derrotas;
  const taxa = state.lutas ? (state.vitorias/state.lutas) : 0;
  tx.textContent = (taxa*100).toFixed(1)+'%';
  pe.textContent = `${state.vitoriasParaEvoluir} vitórias`;
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
  // Ordena por nome
  const nomes = [...STARTERS].sort();
  sel.innerHTML = nomes.map(n=>`<option value="${n}">${titleCase(n)}</option>`).join('');
}

async function construirChipsTipos(containerId){
  const cont = elSel(containerId);
  if(!cont) return;
  cont.innerHTML = '';
  Object.keys(TYPE_MAP).forEach(t=>{
    const b = document.createElement('button');
    b.type='button';
    b.className='tipo-chip '+classeTipo(t);
    b.dataset.tipo=t;
    b.textContent = traduzirTipo(t);
    b.addEventListener('click', ()=>{ b.classList.toggle('ativo'); });
    cont.appendChild(b);
  });
}

function tiposAtivos(containerId){
  const cont = elSel(containerId); if(!cont) return [];
  return [...cont.querySelectorAll('.tipo-chip.ativo')].map(b=>b.dataset.tipo);
}

/* ==================
   CARDS / CONTEÚDOS
   ================== */
function statsBasicos(pk){
  const hp  = pk.stats.find(s=>s.stat.name==='hp')?.base_stat ?? 0;
  const atk = pk.stats.find(s=>s.stat.name==='attack')?.base_stat ?? 0;
  return { hp, atk };
}

function setFoto(node, pk){
  const img = pk.sprites.other?.['official-artwork']?.front_default || pk.sprites.front_default;
  node.querySelector('.foto-selo').innerHTML = img ? `<img src="${img}" alt="${pk.name}" style="max-width:100%;max-height:100%;border-radius:8px;">` : '3x4';
}

function setTipos(node, pk){
  const tipos = pk.types.map(t=>t.type.name);
  const t0 = tipos[0]; // principal
  const tag = node.querySelector('.tag-tipo');
  tag.textContent = tipos.map(traduzirTipo).join(' / ');
  cls(node, 'poke-card', classeTipo(t0));
}

async function setForcaFraqueza(node, pk){
  const tipos = pk.types.map(t=>t.type.name);
  // Combina relações: força se qualquer tipo der double_damage_to; fraqueza se levar double_damage_from
  const rels = await Promise.all(tipos.map(getTypeEffectiveness));
  const to = new Set(), from = new Set();
  for(const r of rels){
    r.double_damage_to.forEach(x=>to.add(x.name));
    r.double_damage_from.forEach(x=>from.add(x.name));
  }
  node.querySelector('.forcafraca').innerHTML =
    `<strong>Força:</strong> ${[...to].map(traduzirTipo).join(', ') || '—'} | 
     <strong>Fraqueza:</strong> ${[...from].map(traduzirTipo).join(', ') || '—'}`;
}

function listarEvolucoesDaChain(chain){
  const res = [];
  function walk(nivel){
    res.push(nivel.species.name);
    (nivel.evolves_to||[]).forEach(walk);
  }
  walk(chain.chain);
  return res;
}

async function setEvolucoes(node, pk){
  try{
    const evo = await getEvolutionChainBySpeciesIdOrName(pk.name);
    const nomes = listarEvolucoesDaChain(evo).map(titleCase);
    node.querySelector('.evolucoes').innerHTML = `<strong>Evoluções:</strong> ${nomes.join(' → ')}`;
    node.dataset.evoChain = JSON.stringify(evo); // guarda para botão Evoluir
  }catch{
    node.querySelector('.evolucoes').textContent = 'Evoluções: —';
  }
}

async function escolher3Golpes(pk){
  // filtra moves que tenham power definido
  const candidatos = [];
  for(const m of pk.moves){
    try{
      const det = await getMoveDetail(m.move.url);
      if(det.power){ // mantém força semelhante, mas dano varia com efetividade e dado
        candidatos.push({ name: det.name, power: det.power, type: det.type.name, damage_class: det.damage_class.name });
      }
      if(candidatos.length >= 12) break; // limite de fetch
    }catch{}
  }
  // escolhe 3 aleatórios
  const shuffle = candidatos.sort(()=> Math.random()-0.5);
  return shuffle.slice(0,3);
}

function renderGolpes(node, golpes, deQuem){
  const wrap = node.querySelector('.golpes-lista');
  wrap.innerHTML = '';
  golpes.forEach((g,i)=>{
    const b = document.createElement('button');
    b.className = 'golpe-btn '+classeTipo(g.type);
    b.dataset.idx = String(i);
    b.title = `${titleCase(g.name)} — ${traduzirTipo(g.type)} • Power ${g.power}`;
    b.textContent = titleCase(g.name.replace('-', ' '));
    if(deQuem==='adv') b.disabled = true;
    wrap.appendChild(b);
  });
}

/* ==================
   EQUIVALÊNCIA / IA
   ================== */
function eMesmoTier(a, b){
  // considera HP e ATK próximos (±15%)
  const A = statsBasicos(a), B = statsBasicos(b);
  const hpOk  = Math.abs(A.hp - B.hp) <= A.hp * 0.15;
  const atkOk = Math.abs(A.atk - B.atk) <= A.atk * 0.15;
  return hpOk && atkOk;
}
async function gerarAdversarioEquivalente(refPk){
  // tenta alguns aleatórios até achar equivalência (limite de tentativas)
  for(let i=0;i<25;i++){
    const randId = Math.floor(Math.random()*300)+1; // primeiras gerações ampliadas
    const pk = await getPokemon(randId);
    if(eMesmoTier(refPk, pk)) return pk;
  }
  // fallback
  return getPokemon(Math.floor(Math.random()*151)+1);
}

/* ===============
   BATALHA / DANO
   =============== */
async function efetividade(atkType, defPk){
  // calcula multiplicador básico usando damage_relations
  let mult = 1;
  const rel = await getTypeEffectiveness(atkType);
  const duplo = new Set(rel.double_damage_to.map(x=>x.name));
  const metade = new Set(rel.half_damage_to.map(x=>x.name));
  const nulo = new Set(rel.no_damage_to.map(x=>x.name));
  for(const t of defPk.types.map(x=>x.type.name)){
    if(nulo.has(t)) mult *= 0;
    else if(duplo.has(t)) mult *= 2;
    else if(metade.has(t)) mult *= 0.5;
  }
  return mult;
}
function rolarDado(){
  return Math.floor(Math.random()*6)+1; // 1..6
}
async function calcularDano(golpe, atacante, defensor, dado){
  const base = golpe.power; // “força semelhante”
  const mult = await efetividade(golpe.type, defensor);
  const bonus = (dado/6); // escala pelo dado (16%..100%)
  const atk  = statsBasicos(atacante).atk;
  // fórmula simples: base * mult * bonus * (1 + atk/400)
  return Math.max(1, Math.round(base * mult * bonus * (1 + atk/400)));
}

/* =================
   EVOLUÇÃO / RAMOS
   ================= */
function opcoesEvolucaoDoAtual(nodeCard, nomeAtual){
  try{
    const evo = JSON.parse(nodeCard.dataset.evoChain || '{}');
    const nomes = listarEvolucoesDaChain(evo);
    // retorna evoluções IMEDIATAS do atual (ramos) se houver
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
  }catch{
    return [];
  }
}

/* ===================
   UI (PÁGINA: JOGO)
   =================== */
async function escolherJogadorPorNome(nome, primeiraEscolha=false){
  const low = String(nome).toLowerCase();
  if(primeiraEscolha && !STARTERS.includes(low)){
    alert('Para a primeira escolha, selecione apenas um Pokémon inicial.');
    return null;
  }
  try{
    const pk = await getPokemon(low);
    state.jogador = pk;
    await preencherCard('#cardJogador', pk, 'jog');
    // gera adversário equivalente
    state.adversario = await gerarAdversarioEquivalente(pk);
    await preencherCard('#cardAdversario', state.adversario, 'adv');
    state.podeTrocarAdversario = true;
    pintarResultado('');
    return pk;
  }catch(e){
    alert('Pokémon não encontrado.');
    return null;
  }
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
  await setForcaFraqueza(node, pk);
  await setEvolucoes(node, pk);
  const golpes = await escolher3Golpes(pk);
  renderGolpes(node, golpes, quem==='adv' ? 'adv' : 'jog');
  if(quem==='adv') state.golpesAdv = golpes; else state.golpesJog = golpes;
}

function pintarResultado(msg){
  const p = elSel('#painelResultado'); if(p) p.textContent = msg || '';
}

function atualizarBotaoEvoluir(){
  const btn = elSel('#btnEvoluir'); if(!btn) return;
  const faltam = state.vitoriasParaEvoluir;
  btn.disabled = (state.vitorias < faltam);
}

/* ========================
   BINDINGS (Página: Jogo)
   ======================== */
function bindJogo(){
  const primeiraVez = !localStorage.getItem('bp_jah_escolheu');
  carregarEstado();
  atualizarStatsUI();
  atualizarBotaoEvoluir();
  construirChipsTipos('#filtrosTipo');
  carregarListaIniciais();

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

  // Botões arena
  elSel('#btnNovoAdversario')?.addEventListener('click', async ()=>{
    if(!state.podeTrocarAdversario){ alert('Só é possível trocar antes da luta começar.'); return; }
    if(!state.jogador){ alert('Escolha seu Pokémon.'); return; }
    state.adversario = await gerarAdversarioEquivalente(state.jogador);
    await preencherCard('#cardAdversario', state.adversario, 'adv');
    pintarResultado('Novo adversário encontrado.');
  });

  elSel('#btnDesistir')?.addEventListener('click', ()=>{
    if(!state.jogador || !state.adversario){ alert('Escolha os dois Pokémons.'); return; }
    state.lutas++; state.derrotas++;
    salvarEstado(); atualizarStatsUI();
    log(`Derrota por desistência contra ${titleCase(state.adversario.name)}`);
    pintarResultado('Você desistiu. Derrota contabilizada.');
    state.podeTrocarAdversario = true;
  });

  let dadoAtual = 1;
  elSel('#btnDado')?.addEventListener('click', ()=>{
    dadoAtual = rolarDado();
    pintarResultado(`🎲 Dado rolado: ${dadoAtual}`);
  });

  elSel('#btnLutar')?.addEventListener('click', async ()=>{
    if(!state.jogador || !state.adversario){ alert('Escolha os dois Pokémons.'); return; }
    state.podeTrocarAdversario = false;

    // golpe do jogador (escolhe o 1º habilitado)
    const gJ = state.golpesJog[0] || {power:40, type:'normal', name:'tackle'};
    const gA = state.golpesAdv[0] || {power:40, type:'normal', name:'tackle'};
    const d = rolarDado();
    const danoJog = await calcularDano(gJ, state.jogador, state.adversario, d);
    const danoAdv = await calcularDano(gA, state.adversario, state.jogador, rolarDado());

    const {hp:hpJog} = statsBasicos(state.jogador);
    const {hp:hpAdv} = statsBasicos(state.adversario);

    const restJog = Math.max(0, hpJog - danoAdv);
    const restAdv = Math.max(0, hpAdv - danoJog);

    let msg;
    state.lutas++;
    if(restAdv === 0 && restJog > 0){
      state.vitorias++;
      msg = `✅ Vitória! Seu ${titleCase(state.jogador.name)} causou ${danoJog} com ${titleCase(gJ.name)} (🎲=${d}).`;
      log(`Vitória sobre ${titleCase(state.adversario.name)}.`);
    }else if(restJog === 0 && restAdv > 0){
      state.derrotas++;
      msg = `❌ Derrota! O ${titleCase(state.adversario.name)} causou ${danoAdv} com ${titleCase(gA.name)}.`;
      log(`Derrota para ${titleCase(state.adversario.name)}.`);
    }else{
      // empate: decide por maior dano causado
      if(danoJog === danoAdv){ msg = '🤝 Empate técnico!'; }
      else if(danoJog > danoAdv){ state.vitorias++; msg='✅ Vitória por dano maior!'; log(`Vitória (dano) vs ${titleCase(state.adversario.name)}.`); }
      else { state.derrotas++; msg='❌ Derrota por dano menor.'; log(`Derrota (dano) vs ${titleCase(state.adversario.name)}.`); }
      state.lutas++;
    }
    salvarEstado(); atualizarStatsUI(); atualizarBotaoEvoluir();
    pintarResultado(msg);
  });

  elSel('#cardJogador')?.addEventListener('click', (ev)=>{
    // permitir clicar em um golpe específico (se quiser)
    const btn = ev.target.closest('.golpe-btn');
    if(!btn) return;
    const idx = Number(btn.dataset.idx);
    // Move escolhido vira o 1º (prioridade)
    if(state.golpesJog[idx]){
      const [g] = state.golpesJog.splice(idx,1);
      state.golpesJog.unshift(g);
      renderGolpes(elSel('#cardJogador'), state.golpesJog, 'jog');
      pintarResultado(`Golpe prioritário: ${titleCase(g.name)}.`);
    }
  });

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

    // Evolui
    state.jogador = await getPokemon(escolha);
    await preencherCard('#cardJogador', state.jogador, 'jog');
    pintarResultado(`🎉 Evoluiu para ${titleCase(escolha)}!`);

    // Regras de nova meta de vitórias
    if(state.vitoriasParaEvoluir===5) state.vitoriasParaEvoluir = 8;
    else if(state.vitoriasParaEvoluir===8) state.vitoriasParaEvoluir = 12;
    // zera vitórias para próxima evolução
    state.vitorias = 0;
    salvarEstado(); atualizarStatsUI(); atualizarBotaoEvoluir();
  });
}

/* ==========================
   UI (PÁGINA: LISTA/INDEX)
   ========================== */
async function bindLista(){
  construirChipsTipos('#tiposLista');
  const ul = elSel('#ulListaPokemons'); if(!ul) return;
  // pega 300 primeiros para navegação
  const data = await fetchJSON(`${API}/pokemon?limit=300`);
  const todos = data.results.map(x=>x.name);
  function render(lista){
    ul.innerHTML = lista.map(n=>`<li>${titleCase(n)}</li>`).join('');
  }
  render(todos);

  elSel('#buscaLista')?.addEventListener('input', (e)=>{
    const q = e.target.value.toLowerCase();
    const tipos = tiposAtivos('#tiposLista');
    // como a rota /pokemon não traz tipos, filtrar só por nome aqui
    const filtrados = todos.filter(n=>n.includes(q));
    render(filtrados);
  });
}

/* ==============================
   UI (PÁGINA: DOCUMENTAÇÃO/API)
   ============================== */
function resumirPokemon(pk){
  // Mostra os campos mais úteis para você decidir novos itens no card
  return {
    id: pk.id,
    name: pk.name,
    height: pk.height,
    weight: pk.weight,
    base_experience: pk.base_experience,
    abilities: pk.abilities.map(a=>a.ability.name),
    types: pk.types.map(t=>t.type.name),
    stats: pk.stats.map(s=>({ stat:s.stat.name, base:s.base_stat })),
    moves_count: pk.moves.length,
    sample_moves: pk.moves.slice(0,5).map(m=>m.move.name),
    sprites: {
      front_default: pk.sprites.front_default,
      official_art: pk.sprites.other?.['official-artwork']?.front_default
    }
  };
}
function resumirSpecies(sp){
  return {
    color: sp.color?.name,
    growth_rate: sp.growth_rate?.name,
    habitat: sp.habitat?.name,
    is_baby: sp.is_baby,
    is_legendary: sp.is_legendary,
    is_mythical: sp.is_mythical,
    capture_rate: sp.capture_rate,
    base_happiness: sp.base_happiness,
    egg_groups: sp.egg_groups?.map(x=>x.name),
    evolution_chain_url: sp.evolution_chain?.url
  };
}
function resumirEvoChain(ev){
  function plano(n){
    return {
      name: n.species.name,
      evolves_to: (n.evolves_to||[]).map(plano)
    };
  }
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
    }catch(e){
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
    // index.html: nada especial além do visual
  }
});
