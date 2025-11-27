import { createClient } from '@supabase/supabase-js';

// Config Supabase
const SUPABASE_URL = 'https://yckkxwbgeppeccdkzjdz.supabase.co';
const SUPABASE_ANON_KEY = 'SUA_CHAVE_AQUI'; // ← substitua pela sua chave anon
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const STORAGE_BUCKET = 'receitas';

const state = { receitas: [], filtroCategoria: '', busca: '', receitaAtual: null };

// Imagens fallback (caso a receita não tenha imagem salva)
function imgFor(title, category) {
  const q = encodeURIComponent(`${category || 'food'} ${title || ''}`);
  return `https://source.unsplash.com/featured/800x600?${q}`;
}

// Define imagem do card/modal
function coverFor(recipe) {
  return recipe && recipe.imagem ? recipe.imagem : imgFor(recipe.titulo, recipe.categoria);
}

// Busca receitas do banco ou carrega defaults se falhar
async function fetchReceitas() {
  const defaults = [
    { id: '1', titulo: 'Bolo de Cenoura', categoria: 'sobremesa', ingredientes: 'Cenoura\nFarinha\nAçúcar\nOvos\nÓleo', modo_preparo: 'Asse 40min a 180ºC', autor: 'Ana', imagem: null },
    { id: '2', titulo: 'Lasanha Bolonhesa', categoria: 'prato-principal', ingredientes: 'Massa\nCarne\nQueijo', modo_preparo: 'Forno 30min', autor: 'Carlos', imagem: null }
  ];

  try {
    const { data, error } = await db
      .from('receitas')
      .select('*')
      .order('criado_em', { ascending: false });

    if (error) {
      console.error("Erro ao buscar receitas:", error);
      return defaults;
    }
    return [...defaults, ...(data || [])];
  } catch (err) {
    console.error("Exceção ao buscar receitas:", err);
    return defaults;
  }
}

// Busca comentários da receita
async function fetchComentarios(idReceita) {
  try {
    const { data, error } = await db
      .from('comentarios')
      .select('*')
      .eq('id_receita', idReceita)
      .order('criado_em', { ascending: false });

    if (error) {
      console.error("Erro ao buscar comentários:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Exceção ao buscar comentários:", err);
    return [];
  }
}

// Salva nova receita no banco
async function insertReceita(rec) {
  try {
    const { data, error } = await db
      .from('receitas')
      .insert(rec)
      .select()
      .single();

    if (error) {
      console.error("Erro ao inserir receita:", error);
      return null;
    }
    return data;
  } catch (err) {
    console.error("Exceção ao inserir receita:", err);
    return null;
  }
}

// Salva novo comentário
async function insertComentario(com) {
  try {
    const { data, error } = await db
      .from('comentarios')
      .insert(com)
      .select()
      .single();

    if (error) {
      console.error("Erro ao inserir comentário:", error);
      return null;
    }
    return data;
  } catch (err) {
    console.error("Exceção ao inserir comentário:", err);
    return null;
  }
}

// Upload da imagem no storage
async function uploadImagem(file, title) {
  if (!file) return null;

  const slug = (title || 'imagem')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
  const path = `uploads/${Date.now()}-${slug}${ext}`;

  try {
    const { error } = await db.storage.from(STORAGE_BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type
    });

    if (error) {
      console.error("Erro no upload da imagem:", error);
      return null;
    }

    const { data } = db.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error("Exceção no upload da imagem:", err);
    return null;
  }
}

// Renderiza receitas na página
function renderReceitas() {
  const grid = document.getElementById('receitas-grid');
  const empty = document.getElementById('empty-state');
  let items = state.receitas;

  if (state.filtroCategoria) {
    items = items.filter(r => r.categoria === state.filtroCategoria);
  }
  if (state.busca) {
    items = items.filter(r => r.titulo.toLowerCase().includes(state.busca.toLowerCase()));
  }

  if (!items.length) {
    empty?.classList.remove('hidden');
    if (grid) grid.innerHTML = '';
    return;
  }

  empty?.classList.add('hidden');
  if (!grid) return;

  grid.innerHTML = items.map(r => `
    <article class="card" data-id="${r.id}">
      <div class="card-cover" style="background-image:url('${coverFor(r)}')"></div>
      <div class="card-body">
        <div class="card-title">${r.titulo}</div>
        <div class="card-meta"><span>${r.categoria}</span><span>•</span><span>${r.autor}</span></div>
        <div class="card-actions">
          <button class="btn btn-secondary open-recipe" data-id="${r.id}">Ver</button>
          <button class="btn btn-primary add-comment" data-id="${r.id}">Comentar</button>
        </div>
      </div>
    </article>
  `).join('');

  grid.querySelectorAll('.open-recipe').forEach(b =>
    b.addEventListener('click', () => openRecipe(b.dataset.id))
  );
}

// Renderiza comentários
function renderComentarios(comments) {
  const list = document.getElementById('comments-list');
  if (!list) return;
  list.innerHTML = comments.map(c => `
    <div class="comment">
      <div class="comment-user">${c.usuario}</div>
      <div class="comment-text">${c.texto}</div>
    </div>
  `).join('');
}

// Abre modal da receita
async function openRecipe(id) {
  const r = state.receitas.find(x => x.id == id);
  if (!r) return;
  state.receitaAtual = r;

  document.getElementById('recipe-cover').style.backgroundImage = `url('${coverFor(r)}')`;
  document.getElementById('recipe-title').textContent = r.titulo;
  document.getElementById('recipe-category').textContent = r.categoria;
  document.getElementById('recipe-author').textContent = r.autor;
  document.getElementById('recipe-ingredients').textContent = r.ingredientes;
  document.getElementById('recipe-method').textContent = r.modo_preparo;
  document.getElementById('recipe-modal')?.classList.remove('hidden');

  const comments = await fetchComentarios(r.id);
  renderComentarios(comments);
}

// Fecha modal
function closeRecipe() {
  document.getElementById('recipe-modal')?.classList.add('hidden');
  state.receitaAtual = null;
}

// Abre modal de nova receita
function openNewRecipe() {
  document.getElementById('new-recipe-modal')?.classList.remove('hidden');
}

// Fecha modal de nova receita
function closeNewRecipe() {
  document.getElementById('new-recipe-modal')?.classList.add('hidden');
}

// Submit do form de nova receita
async function submitNewRecipe(e) {
  e.preventDefault();

  const rec = {
    titulo: document.getElementById('titulo').value.trim(),
    categoria: document.getElementById('categoria').value,
    autor: document.getElementById('autor').value.trim(),
    ingredientes: document.getElementById('ingredientes').value.trim(),
    modo_preparo: document.getElementById('modo_preparo').value.trim()
  };

  if (!rec.titulo || !rec.categoria || !rec.autor || !rec.ingredientes || !rec.modo_preparo) return;

  const file = document.getElementById('imagem')?.files?.[0];
  rec.imagem = await uploadImagem(file, rec.titulo);

  const saved = await insertReceita(rec);

  if (saved) {
    state.receitas.unshift(saved);
  } else {
    state.receitas.unshift({ ...rec, id: Date.now().toString(), imagem: rec.imagem });
  }

  renderReceitas();
  closeNewRecipe();
  e.target.reset();
}

// Boot da aplicação
async function boot() {
  document.getElementById('buscar-btn')?.addEventListener('click', () => {
    state.busca = document.getElementById('busca-input').value;
    renderReceitas();
  });

  document.getElementById('categoria-filter')?.addEventListener('change', e => {
    state.filtroCategoria = e.target.value;
    renderReceitas();
  });

  document.getElementById('open-new-recipe')?.addEventListener('click', openNewRecipe);
  document.getElementById('new-recipe-form')?.addEventListener('submit', submitNewRecipe);
  document.getElementById('close-recipe-modal')?.addEventListener('click', closeRecipe);
  document.getElementById('close-new-recipe')?.addEventListener('click', closeNewRecipe);

  state.receitas = await fetchReceitas();
  renderReceitas();
}

document.addEventListener('DOMContentLoaded', boot);
