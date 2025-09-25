async function buscarPokemon(nome) {
  const resposta = await fetch(`https://pokeapi.co/api/v2/pokemon/${nome.toLowerCase()}`);
  if (!resposta.ok) {
    throw new Error("Pokémon não encontrado!");
  }
  return resposta.json();
}

function exibirPokemon(pokemon, titulo) {
  const stat = pokemon.stats[0].base_stat; // HP como base para comparar
  return `
    <div class="pokemon-card">
      <h3>${titulo}</h3>
      <img src="${pokemon.sprites.front_default}" alt="${pokemon.name}">
      <p><b>${pokemon.name.toUpperCase()}</b></p>
      <p>HP: ${stat}</p>
    </div>
  `;
}

async function batalhar() {
  const nome = document.getElementById("pokemonInput").value.trim();
  if (!nome) {
    alert("Digite o nome de um Pokémon!");
    return;
  }

  try {
    const meuPokemon = await buscarPokemon(nome);
    const rivalId = Math.floor(Math.random() * 151) + 1; // 1ª geração
    const rivalPokemon = await buscarPokemon(rivalId);

    const meuHP = meuPokemon.stats[0].base_stat;
    const rivalHP = rivalPokemon.stats[0].base_stat;

    let resultado = "";
    if (meuHP > rivalHP) {
      resultado = "Você venceu!";
    } else if (meuHP < rivalHP) {
      resultado = "Você perdeu!";
    } else {
      resultado = "Empate!";
    }

    document.getElementById("resultado").innerHTML = 
      exibirPokemon(meuPokemon, "Seu Pokémon") + 
      exibirPokemon(rivalPokemon, "Rival") + 
      `<h2>${resultado}</h2>`;
  } catch (e) {
    document.getElementById("resultado").innerHTML = `<p style="color:red;">${e.message}</p>`;
  }
}
