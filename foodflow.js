import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yckkxwbgeppeccdkzjdz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlja2t4d2JnZXBwZWNjZGt6amR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NzE1MDIsImV4cCI6MjA3OTA0NzUwMn0.3NAzr8mdGyuJnKadwBjHYjP16T_wrkIPZdIYpU4v2fI';

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const STORAGE_BUCKET = 'receitas';

const state = { receitas: [], filtroCategoria: '', busca: '', receitaAtual: null };

function imgFor(title, category) {
  const q = encodeURIComponent(`${category || 'food'} ${title || ''}`);
  return `https://source.unsplash.com/featured/800x600?${q}`;
}

function coverFor(recipe) {
  return recipe && recipe.imagem ? recipe.imagem : imgFor(recipe.titulo, recipe.categoria);
}

async function fetchReceitas() {
  const defaults = [
    { id: '1', titulo: 'Bolo de Cenoura', categoria: 'sobremesa', ingredientes: 'Cenoura\nFarinha\nAçúcar\nOvos\nÓleo', modo_preparo: 'Misture tudo e asse por 40min a 180ºC', autor: 'Ana', imagem: '/img/boloCenoura.jpg' },
    { id: '2', titulo: 'Lasanha Bolonhesa', categoria: 'prato-principal', ingredientes: 'Massa\nMolho\nCarne Moída\nQueijo', modo_preparo: 'Monte em camadas e leve ao forno por 30min', autor: 'Carlos', imagem: '/img/lasanha.jpg' },
    { id: '3', titulo: 'Bruschetta', categoria: 'entrada', ingredientes: 'Pão\nTomate\nManjericão\nAzeite', modo_preparo: 'Toste o pão e cubra com tomate temperado', autor: 'Julia', imagem: '/img/bruschetta.jpg' }
  ];

  try {
    const { data, error } = await db
      .from('receitas')
      .select('*')
      .order('created_at', { ascending: false });

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

async function fetchComentarios(idReceita) {
  try {
    const { data, error } = await db
      .from('comentarios')
      .select('*')
      .eq('id_receita', idReceita)
      .order('created_at', { ascending: false });

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

async function insertReceita(rec) {
  try {
    const { data, error } = await db
      .from('receitas')
      .insert(rec)
      .select()
      .single();

    if (error) console.error("Erro ao inserir receita:", error);
    return { data, error };
  } catch (err) {
    console.error("Exceção ao inserir receita:", err);
    return { data: null, error: err };
  }
}

async function insertComentario(com) {
  try {
    const { data, error } = await db
      .from('comentarios')
      .insert(com)
      .select()
      .single();

    if (error) console.error("Erro ao inserir comentário:", error);
    return { data, error };
  } catch (err) {
    console.error("Exceção ao inserir comentário:", err);
    return { data: null, error: err };
  }
}

async function uploadImagem(file, title) {
  if (!file) return null;

  const slug = (title || 'imagem')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'');

  const ext = file.name.includes('.') 
    ? file.name.slice(file.name.lastIndexOf('.')) 
    : '';

  const path = `uploads/${Date.now()}-${slug}${ext}`;

  try {
    const { error } = await db
      .storage
      .from(STORAGE_BUCKET)
      .upload(path, file, {
        upsert: true,
        contentType: file.type
      });

    if (error) {
      console.error("Erro no upload da imagem:", error);
      return null;
    }

    const { data } = db
      .storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(path);

    return data.publicUrl;
  } catch (err) {
    console.error("Exceção no upload da imagem:", err);
    return null;
  }
}

// Modais de auth
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

// Ações Auth
async function signIn(e) {
  e.preventDefault();
  const msgEl = document.getElementById('login-msg');
  const submitBtn = e.target.querySelector('button[type="submit"]');

  msgEl?.classList.add('hidden');
  if (msgEl) msgEl.textContent = '';

  if (submitBtn) submitBtn.disabled = true;

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value.trim();

  if (!email || !password) {
    if (submitBtn) submitBtn.disabled = false;
    return;
  }

  const { error } = await db.auth.signInWithPassword({ email, password });

  if (error) {
    msgEl && (msgEl.textContent = error.message);
    msgEl?.classList.remove('hidden');
    msgEl?.classList.add('error');
    if (submitBtn) submitBtn.disabled = false;
    return;
  }

  msgEl && (msgEl.textContent = "Login realizado com sucesso!");
  msgEl?.classList.remove('hidden');
  msgEl?.classList.add('success');

  closeAuth();
  state.receitas = await fetchReceitas();
  renderReceitas();

  if (submitBtn) submitBtn.disabled = false;
}

async function signUp(e) {
  e.preventDefault();
  const msgEl = document.getElementById('signup-msg');
  const submitBtn = e.target.querySelector('button[type="submit"]');

  msgEl?.classList.add('hidden');
  if (msgEl) msgEl.textContent = '';
  if (submitBtn) submitBtn.disabled = true;

  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value.trim();

  if (!email || !password) {
    if (submitBtn) submitBtn.disabled = false;
    return;
  }

  const { error } = await db.auth.signUp({
    email,
    password,
    options: {
      data: { name }
    }
  });

  if (error) {
    msgEl && (msgEl.textContent = error.message);
    msgEl?.classList.remove('hidden');
    msgEl?.classList.add('error');
    if (submitBtn) submitBtn.disabled = false;
    return;
  }

  // logar automaticamente após signup
  const { error: signInError } = await db.auth.signInWithPassword({ email, password });

  if (signInError) {
    msgEl && (msgEl.textContent = signInError.message);
    msgEl?.classList.remove('hidden');
    msgEl?.classList.add('error');
    if (submitBtn) submitBtn.disabled = false;
    return;
  }

  closeAuth();
  state.receitas = await fetchReceitas();
  renderReceitas();
  if (submitBtn) submitBtn.disabled = false;
}

// Renderização
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

  grid.querySelectorAll('.add-comment').forEach(b =>
    b.addEventListener('click', () => openRecipe(b.dataset.id))
  );
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
  document.getElementById('recipe-modal').classList.remove('hidden');

  const comments = await fetchComentarios(r.id);
  renderComentarios(comments);
}

function closeRecipe() {
  document.getElementById('recipe-modal')?.classList.add('hidden');
  state.receitaAtual = null;
}

// Comentários
async function submitComment(e) {
  e.preventDefault();
  if (!state.receitaAtual) return;

  const com = {
    id_receita: state.receitaAtual.id,
    usuario: document.getElementById('comment-user').value.trim(),
    texto: document.getElementById('comment-text').value.trim()
  };
  if (!com.usuario || !com.texto) return;

  const { error } = await insertComentario(com);
  if (error) return;
  const comments = await fetchComentarios(state.receitaAtual.id);
  renderComentarios(comments);
  document.getElementById('comment-form')?.reset();
}

// Nova receita modal
function openNewRecipe() {
  document.getElementById('new-recipe-modal')?.classList.remove('hidden');
}

function closeNewRecipe() {
  document.getElementById('new-recipe-modal')?.classList.add('hidden');
}

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

  const fileInput = document.getElementById('imagem');
  const file = fileInput?.files?.[0];
  rec.imagem = await uploadImagem(file, rec.titulo);

  const { data, error } = await insertReceita(rec);
  if (error) return;
  if (data) state.receitas.unshift(data);

  renderReceitas();
  closeNewRecipe();
  e.target.reset();
}

// Boot
async function boot() {
  document.getElementById('buscar-btn')?.addEventListener('click', () => {
    state.busca = document.getElementById('busca-input').value;
    renderReceitas();
  });

  document.getElementById('categoria-filter')?.addEventListener('change', e => {
    state.filtroCategoria = e.target.value;
    renderReceitas();
  });

  document.getElementById('open-new-recipe')?.addEventListener('click', e => {
    e.preventDefault();
    openNewRecipe();
  });

  document.getElementById('new-recipe-form')?.addEventListener('submit', submitNewRecipe);
  document.getElementById('comment-form')?.addEventListener('submit', submitComment);
  document.getElementById('close-recipe-modal')?.addEventListener('click', closeRecipe);
  document.getElementById('close-new-recipe')?.addEventListener('click', closeNewRecipe);
  document.getElementById('close-login')?.addEventListener('click', closeAuth);
  document.getElementById('close-signup')?.addEventListener('click', closeAuth);

  // Teste de conexão (debug)
  const t = await db.from('receitas').select('id').limit(1);
  console.log("Supabase Connection Test:", t);

  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    openLogin();
    return;
  }

  state.receitas = await fetchReceitas();
  renderReceitas();
}

document.addEventListener('DOMContentLoaded', boot);
