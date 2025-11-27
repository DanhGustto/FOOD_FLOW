// ====================== SUPABASE CONFIG ======================
const SUPABASE_URL = 'https://yckkxwbgeppeccdkzjdz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlja2t4d2JnZXBwZWNjZGt6amR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NzE1MDIsImV4cCI6MjA3OTA0NzUwMn0.3NAzr8mdGyuJnKadwBjHYjP16T_wrkIPZdIYpU4v2fI';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const STORAGE_BUCKET = 'receitas';

// ====================== STATE ======================
const state = { receitas: [], filtroCategoria: '', busca: '', receitaAtual: null };

// ====================== IMAGE HELPERS ======================
function imgFor(title, category) {
  const q = encodeURIComponent(`${category || 'food'} ${title || ''}`);
  return `https://source.unsplash.com/featured/800x600?${q}`;
}

function coverFor(recipe) {
  return recipe && recipe.imagem ? recipe.imagem : imgFor(recipe.titulo, recipe.categoria);
}

// ====================== FETCH FUNCTIONS ======================
async function fetchReceitas() {
  const defaults = [
    { id: '1', titulo: 'Bolo de Cenoura', categoria: 'sobremesa', ingredientes: 'Cenoura\nFarinha\nAçúcar\nOvos\nÓleo', modo_de_preparo: 'Misture tudo e asse por 40min a 180ºC', autor: 'Ana', imagem: 'img/boloCenoura.jpg', criado_em: new Date().toISOString() },
    { id: '2', titulo: 'Lasanha Bolonhesa', categoria: 'prato-principal', ingredientes: 'Massa\nMolho\nCarne Moída\nQueijo', modo_de_preparo: 'Monte em camadas e leve ao forno por 30min', autor: 'Carlos', imagem: 'img/lasanha.jpg', criado_em: new Date().toISOString() },
    { id: '3', titulo: 'Bruschetta', categoria: 'entrada', ingredientes: 'Pão\nTomate\nManjericão\nAzeite', modo_de_preparo: 'Toste o pão e cubra com tomate temperado', autor: 'Julia', imagem: 'img/bruschetta.jpg', criado_em: new Date().toISOString() }
  ];

  try {
    const { data, error } = await db.from('receitas').select('*').order('criado_em', { ascending: false });
    if (error) throw error;
    return [...defaults, ...(data || [])];
  } catch (err) {
    console.error('Erro ao buscar receitas:', err.message);
    return defaults;
  }
}

async function fetchComentarios(idReceita) {
  try {
    const { data, error } = await db.from('comentarios').select('*').eq('receita_id', idReceita).order('criado_em', { ascending: false });
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao buscar comentários:', err.message);
    return [];
  }
}

// ====================== INSERT FUNCTIONS ======================
async function insertReceita(rec) {
  return await db.from('receitas').insert(rec).select().single();
}

async function insertComentario(com) {
  return await db.from('comentarios').insert(com).select().single();
}

// ====================== STORAGE UPLOAD ======================
async function uploadImagem(file, title) {
  if (!file) return null;

  const slug = (title || 'imagem').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const ext = file.name.slice(file.name.lastIndexOf('.'));
  const path = `uploads/${Date.now()}-${slug}${ext}`;

  try {
    const { error } = await db.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    return db.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  } catch (err) {
    console.error('Erro ao fazer upload da imagem:', err.message);
    return null;
  }
}

// ====================== MODAL CONTROLS ======================
function openLogin() {
  document.getElementById('login-modal')?.classList.remove('hidden');
  document.getElementById('signup-modal')?.classList.add('hidden');
}

function openSignup() {
  document.getElementById('signup-modal')?.classList.remove('hidden');
  document.getElementById('login-modal')?.classList.add('hidden');
}

function closeAuth() {
  document.getElementById('login-modal')?.classList.add('hidden');
  document.getElementById('signup-modal')?.classList.add('hidden');
}

function closeRecipe() {
  document.getElementById('recipe-modal')?.classList.add('hidden');
  state.receitaAtual = null;
}

function openNewRecipe() {
  document.getElementById('new-recipe-modal')?.classList.remove('hidden');
}

function closeNewRecipe() {
  document.getElementById('new-recipe-modal')?.classList.add('hidden');
}

// ====================== RENDER ======================
function renderReceitas() {
  const grid = document.getElementById('receitas-grid');
  const empty = document.getElementById('empty-state');

  let items = state.receitas;
  if (state.filtroCategoria) items = items.filter(r => r.categoria === state.filtroCategoria);
  if (state.busca) items = items.filter(r => r.titulo.toLowerCase().includes(state.busca.toLowerCase()));

  if (!items.length) {
    empty?.classList.remove('hidden');
    grid.innerHTML = '';
    return;
  }

  empty?.classList.add('hidden');
  grid.innerHTML = items.map(r => `
    <article class="card" data-id="${r.id}">
      <div class="card-cover" style="background-image:url('${coverFor(r)}')"></div>
      <div class="card-body">
        <div class="card-title">${r.titulo}</div>
        <div class="card-meta"><span>${r.categoria}</span><span>•</span><span>${r.autor || ''}</span></div>
        <div class="card-actions">
          <button class="btn btn-secondary open-recipe" data-id="${r.id}"><i class="fa-solid fa-eye"></i> Ver</button>
          <button class="btn btn-primary add-comment" data-id="${r.id}"><i class="fa-solid fa-comment"></i> Comentar</button>
        </div>
      </div>
    </article>
  `).join('');

  grid.querySelectorAll('.open-recipe').forEach(b => b.addEventListener('click', () => openRecipe(b.dataset.id)));
  grid.querySelectorAll('.add-comment').forEach(b => b.addEventListener('click', () => openRecipe(b.dataset.id)));
}

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

// ====================== OPEN RECIPE ======================
async function openRecipe(id) {
  const r = state.receitas.find(x => x.id == id);
  if (!r) return;

  state.receitaAtual = r;

  document.getElementById('recipe-cover').style.backgroundImage = `url('${coverFor(r)}')`;
  document.getElementById('recipe-title').textContent = r.titulo;
  document.getElementById('recipe-category').textContent = r.categoria;
  document.getElementById('recipe-author').textContent = r.autor;
  document.getElementById('recipe-ingredients').textContent = r.ingredientes;
  document.getElementById('recipe-method').textContent = r.modo_de_preparo; // ✅ agora certo!

  document.getElementById('recipe-modal')?.classList.remove('hidden');

  const comments = await fetchComentarios(r.id);
  renderComentarios(comments);
}

// ====================== FORM SUBMIT NEW RECIPE ======================
async function submitNewRecipe(e) {
  e.preventDefault();

  const rec = {
    titulo: document.getElementById('titulo').value.trim(),
    categoria: document.getElementById('categoria').value,
    autor: document.getElementById('autor').value.trim(),
    ingredientes: document.getElementById('ingredientes').value.trim(),
    modo_de_preparo: document.getElementById('modo_preparo').value.trim() // ✅ agora igual no Supabase
  };

  if (!rec.titulo || !rec.categoria || !rec.autor || !rec.ingredientes || !rec.modo_de_preparo) return;

  const imagemInput = document.getElementById('imagem');
  const file = imagemInput?.files?.[0];
  rec.imagem = await uploadImagem(file, rec.titulo);

  const { data, error } = await insertReceita(rec);
  if (error) {
    console.error("Erro ao salvar receita:", error.message);
    alert("Erro ao salvar receita!\n" + error.message);
    return;
  }

  if (data) state.receitas.unshift(data);
  renderReceitas();
  closeNewRecipe();
  e.target.reset();
}

// ====================== FORM SUBMIT COMMENT ======================
async function submitComment(e) {
  e.preventDefault();
  if (!state.receitaAtual) return;

  const com = {
    id_receita: state.receitaAtual.id,
    usuario: document.getElementById('comment-user').value.trim(),
    texto: document.getElementById('comment-text').value.trim()
  };

  if (!com.usuario || !com.texto) return;

  await insertComentario(com);
  const comments = await fetchComentarios(state.receitaAtual.id);
  renderComentarios(comments);
  document.getElementById('comment-form')?.reset();
}

// ====================== INIT / BOOT ======================
async function boot() {
  console.log("🚀 Booting FoodFlow...");
  document.getElementById('buscar-btn')?.addEventListener('click', () => {
    state.busca = document.getElementById('busca-input').value;
    renderReceitas();
  });

  document.getElementById('categoria-filter')?.addEventListener('change', (e) => {
    state.filtroCategoria = e.target.value;
    renderReceitas();
  });

  document.getElementById('open-new-recipe')?.addEventListener('click', (e) => {
    e.preventDefault();
    openNewRecipe();
  });

  document.getElementById('close-new-recipe')?.addEventListener('click', closeNewRecipe);
  document.getElementById('close-recipe-modal')?.addEventListener('click', closeRecipe);
  document.getElementById('new-recipe-form')?.addEventListener('submit', submitNewRecipe);
  document.getElementById('comment-form')?.addEventListener('submit', submitComment);

  state.receitas = await fetchReceitas();
  renderReceitas();
}

document.addEventListener('DOMContentLoaded', boot);

