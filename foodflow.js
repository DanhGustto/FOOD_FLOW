
const SUPABASE_URL = 'https://yckkxwbgeppeccdkzjdz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlja2t4d2JnZXBwZWNjZGt6amR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NzE1MDIsImV4cCI6MjA3OTA0NzUwMn0.3NAzr8mdGyuJnKadwBjHYjP16T_wrkIPZdIYpU4v2fI';
const db = SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
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
    { id: '1', titulo: 'Bolo de Cenoura', categoria: 'sobremesa', ingredientes: 'Cenoura\nFarinha\nAçúcar\nOvos\nÓleo', modo_preparo: 'Misture tudo e asse por 40min a 180ºC', autor: 'Ana', imagem: 'img/boloCenoura.jpg' },
    { id: '2', titulo: 'Lasanha Bolonhesa', categoria: 'prato-principal', ingredientes: 'Massa\nMolho\nCarne Moída\nQueijo', modo_preparo: 'Monte em camadas e leve ao forno por 30min', autor: 'Carlos', imagem: 'img/lasanha.jpg' },
    { id: '3', titulo: 'Bruschetta', categoria: 'entrada', ingredientes: 'Pão\nTomate\nManjericão\nAzeite', modo_preparo: 'Toste o pão e cubra com tomate temperado', autor: 'Julia', imagem: 'img/bruschetta.jpg' }
  ];
  if (db) {
    try {
      const { data, error } = await db.from('receitas').select('*').order('created_at', { ascending: false });
      if (error) return defaults;
      return [...defaults, ...(data || [])];
    } catch {
      return defaults;
    }
  }
  return defaults;
}

async function fetchComentarios(idReceita) {
  if (db) {
    const { data, error } = await db.from('comentarios').select('*').eq('id_receita', idReceita).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }
  return [];
}

async function insertReceita(rec) {
  if (!db) return { error: 'no-db' };
  const { data, error } = await db.from('receitas').insert(rec).select().single();
  return { data, error };
}

async function insertComentario(com) {
  if (!db) return { error: 'no-db' };
  const { data, error } = await db.from('comentarios').insert(com).select().single();
  return { data, error };
}

async function uploadImagem(file, title) {
  if (!file) return null;
  if (!db) return URL.createObjectURL(file);
  const slug = (title || 'imagem').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  const ext = file.name && file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
  const path = `uploads/${Date.now()}-${slug}${ext}`;
  const { error } = await db.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: true, contentType: file.type });
  if (error) return null;
  const { data } = await db.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function openLogin() {
  const l = document.getElementById('login-modal');
  const s = document.getElementById('signup-modal');
  if (l) l.classList.remove('hidden');
  if (s) s.classList.add('hidden');
}

function openSignup() {
  const l = document.getElementById('login-modal');
  const s = document.getElementById('signup-modal');
  if (s) s.classList.remove('hidden');
  if (l) l.classList.add('hidden');
}

function closeAuth() {
  const l = document.getElementById('login-modal');
  const s = document.getElementById('signup-modal');
  if (l) l.classList.add('hidden');
  if (s) s.classList.add('hidden');
}

async function signIn(e) {
  e.preventDefault();
  const msgEl = document.getElementById('login-msg');
  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (msgEl) { msgEl.classList.add('hidden'); msgEl.textContent = ''; msgEl.className = 'alert'; }
  submitBtn && (submitBtn.disabled = true);
  if (!db) { closeAuth(); state.receitas = await fetchReceitas(); renderReceitas(); submitBtn && (submitBtn.disabled = false); return; }
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value.trim();
  if (!email || !password) { submitBtn && (submitBtn.disabled = false); return; }
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) { if (msgEl) { msgEl.textContent = error.message; msgEl.classList.remove('hidden'); msgEl.classList.add('error'); } submitBtn && (submitBtn.disabled = false); return; }
  if (msgEl) { msgEl.textContent = 'Login realizado'; msgEl.classList.remove('hidden'); msgEl.classList.add('success'); }
  closeAuth();
  state.receitas = await fetchReceitas();
  renderReceitas();
  submitBtn && (submitBtn.disabled = false);
}

async function signUp(e) {
  e.preventDefault();
  const msgEl = document.getElementById('signup-msg');
  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (msgEl) { msgEl.classList.add('hidden'); msgEl.textContent = ''; msgEl.className = 'alert'; }
  submitBtn && (submitBtn.disabled = true);
  if (!db) { submitBtn && (submitBtn.disabled = false); return; }
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value.trim();
  if (!email || !password) { submitBtn && (submitBtn.disabled = false); return; }
  const { error } = await db.auth.signUp({ email, password, options: { data: { name } } });
  if (error) { if (msgEl) { msgEl.textContent = error.message; msgEl.classList.remove('hidden'); msgEl.classList.add('error'); } submitBtn && (submitBtn.disabled = false); return; }
  const { error: signInError } = await db.auth.signInWithPassword({ email, password });
  if (signInError) { if (msgEl) { msgEl.textContent = signInError.message; msgEl.classList.remove('hidden'); msgEl.classList.add('error'); } submitBtn && (submitBtn.disabled = false); return; }
  closeAuth();
  state.receitas = await fetchReceitas();
  renderReceitas();
  submitBtn && (submitBtn.disabled = false);
}

function renderReceitas() {
  const grid = document.getElementById('receitas-grid');
  const empty = document.getElementById('empty-state');
  let items = state.receitas;
  if (state.filtroCategoria) items = items.filter(r => r.categoria === state.filtroCategoria);
  if (state.busca) items = items.filter(r => r.titulo.toLowerCase().includes(state.busca.toLowerCase()));
  if (!items.length) {
    empty.classList.remove('hidden');
    grid.innerHTML = '';
    return;
  }
  empty.classList.add('hidden');
  grid.innerHTML = items.map(r => `
    <article class="card" data-id="${r.id}">
      <div class="card-cover" style="background-image:url('${coverFor(r)}')"></div>
      <div class="card-body">
        <div class="card-title">${r.titulo}</div>
        <div class="card-meta"><span>${r.categoria}</span><span>•</span><span>${r.autor}</span></div>
        <div class="card-actions"><button class="btn btn-secondary open-recipe" data-id="${r.id}"><i class="fa-solid fa-eye"></i> Ver</button><button class="btn btn-primary add-comment" data-id="${r.id}"><i class="fa-solid fa-comment"></i> Comentar</button></div>
      </div>
    </article>
  `).join('');
  grid.querySelectorAll('.open-recipe').forEach(b => b.addEventListener('click', () => openRecipe(b.dataset.id)));
  grid.querySelectorAll('.add-comment').forEach(b => b.addEventListener('click', () => openRecipe(b.dataset.id)));
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

function renderComentarios(comments) {
  const list = document.getElementById('comments-list');
  list.innerHTML = comments.map(c => `
    <div class="comment">
      <div class="comment-user">${c.usuario}</div>
      <div class="comment-text">${c.texto}</div>
    </div>
  `).join('');
}

function closeRecipe() {
  document.getElementById('recipe-modal').classList.add('hidden');
  state.receitaAtual = null;
}

function openNewRecipe() {
  document.getElementById('new-recipe-modal').classList.remove('hidden');
}

function closeNewRecipe() {
  document.getElementById('new-recipe-modal').classList.add('hidden');
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
  const file = fileInput && fileInput.files && fileInput.files[0];
  rec.imagem = await uploadImagem(file, rec.titulo);
  const { data, error } = await insertReceita(rec);
  if (error && error !== 'no-db') return;
  if (data) state.receitas.unshift(data);
  if (!db) {
    const id = Date.now().toString();
    state.receitas.unshift({ ...rec, id });
  }
  renderReceitas();
  closeNewRecipe();
  e.target.reset();
}

async function submitComment(e) {
  e.preventDefault();
  if (!state.receitaAtual) return;
  const com = {
    id_receita: state.receitaAtual.id,
    usuario: document.getElementById('comment-user').value.trim(),
    texto: document.getElementById('comment-text').value.trim()
  };
  if (!com.usuario || !com.texto) return;
  const { data, error } = await insertComentario(com);
  if (error && error !== 'no-db') return;
  const comments = await fetchComentarios(state.receitaAtual.id);
  renderComentarios(comments);
  if (!db) {
    renderComentarios([{ ...com }]);
  }
  document.getElementById('comment-form').reset();
}

async function boot() {
  document.getElementById('buscar-btn').addEventListener('click', () => { state.busca = document.getElementById('busca-input').value; renderReceitas() });
  document.getElementById('categoria-filter').addEventListener('change', e => { state.filtroCategoria = e.target.value; renderReceitas() });
  document.getElementById('open-new-recipe').addEventListener('click', e => { e.preventDefault(); openNewRecipe() });
  document.getElementById('close-new-recipe').addEventListener('click', closeNewRecipe);
  document.getElementById('close-recipe-modal').addEventListener('click', closeRecipe);
  const recipeOverlay = document.getElementById('recipe-modal');
  recipeOverlay.addEventListener('click', e => { if (e.target === recipeOverlay) closeRecipe() });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !recipeOverlay.classList.contains('hidden')) closeRecipe() });
  document.getElementById('new-recipe-form').addEventListener('submit', submitNewRecipe);
  document.getElementById('comment-form').addEventListener('submit', submitComment);
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const openSignupBtn = document.getElementById('open-signup');
  const openLoginBtn = document.getElementById('open-login');
  const closeLoginBtn = document.getElementById('close-login');
  const closeSignupBtn = document.getElementById('close-signup');
  if (loginForm) loginForm.addEventListener('submit', signIn);
  if (signupForm) signupForm.addEventListener('submit', signUp);
  if (openSignupBtn) openSignupBtn.addEventListener('click', openSignup);
  if (openLoginBtn) openLoginBtn.addEventListener('click', openLogin);
  if (closeLoginBtn) closeLoginBtn.addEventListener('click', closeAuth);
  if (closeSignupBtn) closeSignupBtn.addEventListener('click', closeAuth);
  if (db) {
    const { data: { session } } = await db.auth.getSession();
    if (!session) { openLogin(); return; }
  }
  state.receitas = await fetchReceitas();
  renderReceitas();
}

document.addEventListener('DOMContentLoaded', boot);