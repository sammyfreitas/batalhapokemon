const API = "https://pokeapi.co/api/v2";

async function carregarPokemons(limit = 50, offset = 0) {
  const resp = await fetch(`${API}/pokemon?limit=${limit}&offset=${offset}`);
  const data = await resp.json();

  const ul = document.getElementById("ulListaPokemons");
  ul.innerHTML = "";

  for (const p of data.results) {
    const detalhes = await fetch(p.url).then(r => r.json());

    const li = document.createElement("li");
    li.className = "pokemon-card";
    li.dataset.id = detalhes.id;
    li.innerHTML = `
      <img src="${detalhes.sprites.front_default}" alt="${detalhes.name}">
      <h3>${detalhes.name}</h3>
    `;

    ul.appendChild(li);
  }
}

// Exibir detalhes do Pokémon no card lateral
async function mostrarDetalhes(id) {
  const resp = await fetch(`${API}/pokemon/${id}`);
  const pokemon = await resp.json();

  const div = document.getElementById("detalhePokemon");
  div.innerHTML = `
    <h2>${pokemon.name} #${pokemon.id}</h2>
    <img src="${pokemon.sprites.other["official-artwork"].front_default}" alt="${pokemon.name}">
    <p><strong>Tipos:</strong> ${pokemon.types.map(t => t.type.name).join(", ")}</p>
    <p><strong>Altura:</strong> ${pokemon.height / 10} m</p>
    <p><strong>Peso:</strong> ${pokemon.weight / 10} kg</p>
  `;
  div.scrollIntoView({ behavior: "smooth" });
}

document.addEventListener("DOMContentLoaded", () => {
  carregarPokemons();

  const lista = document.getElementById("ulListaPokemons");
  lista.addEventListener("click", (e) => {
    const card = e.target.closest(".pokemon-card");
    if (!card) return;
    mostrarDetalhes(card.dataset.id);
  });
});
