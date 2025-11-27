/* ====== Supabase config (mantive sua URL e ANON KEY como pediu) ====== */
const SUPABASE_URL = 'https://yckkxwbgeppeccdkzjdz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlja2t4d2JnZXBwZWNjZGt6amR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NzE1MDIsImV4cCI6MjA3OTA0NzUwMn0.3NAzr8mdGyuJnKadwBjHYjP16T_wrkIPZdIYpU4v2fI';
const db = (typeof window !== 'undefined' && window.supabase) ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const STORAGE_BUCKET = 'receitas';

const state = { receitas: [], filtroCategoria: '', busca: '', receitaAtual: null };

/* ====== util images ====== */
function imgFor(title, category) {
  const q = encodeURIComponent(`${category || 'food'} ${title || ''}`);
  return `https://source.unsplash.com/featured/800x600?${q}`;
}

function coverFor(recipe) {
  try {
    return recipe && recipe.imagem ? recipe.imagem : imgFor(recipe.titulo, recipe.categoria);
  } catch {
    return imgFor('', 'food');
  }
}

/* ====== fetch receitas ====== */
async function fetchReceitas() {
  const defaults = [
    { id: '1', titulo: 'Bolo de Cenoura', categoria: 'sobremesa', ingredientes: 'Cenoura\nFarinha\nAçúcar\nOvos\nÓleo', modo_preparo: 'Misture tudo e asse por 40min a 180ºC', autor: 'Ana', imagem: '/img/boloCenoura.jpg', criado_em: new Date().toISOString() },
    { id: '2', titulo: 'Lasanha Bolonhesa', categoria: 'prato-principal', ingredientes: 'Massa\nMolho\nCarne Moída\nQueijo', modo_preparo: 'Monte em camadas e leve ao forno por 30min', autor: 'Carlos', imagem: '/img/lasanha.jpg', criado_em: new Date().toISOString() },
    { id: '3', titulo: 'Bruschetta', categoria: 'entrada', ingredientes: 'Pão\nTomate\nManjericão\nAzeite', modo_preparo: 'Toste o pão e cubra com tomate temperado', autor: 'Julia', imagem: '/img/bruschetta.jpg', criado_em: new Date().toISOString() }
  ];

  if (!db) return defaults;

  try {
    // note: usar "criado_em" (nome exato da sua coluna)
    const { data, error } = await db.from('receitas').select('*').order('criado_em', { ascending: false });
    if (error) {
      console.error('fetchReceitas error:', error);
      return defaults;
    }
    return [...defaults, ...(data || [])];
  } catch (err) {
    console.error('fetchReceitas exception:', err);
    return defaults;
  }
}

/* ====== fetch comentarios ====== */
async function fetchComentarios(idReceita) {
  if (!db) return [];
  try {
    const { data, error } = await db
      .from('comentarios')
      .select('*')
      .eq('id_receita', idReceita)
      .order('criado_em', { ascending: false });
    if (error) {
      console.error('fetchComentarios error:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('fetchComentarios exception:', err);
    return [];
  }
}

/* ====== insert receita ====== */
async function insertReceita(rec) {
  if (!db) return { error: 'no-db' };
  try {
    const { data, error } = await db.from('receitas').insert(rec).select().single();
    if (error) {
      console.error('insertReceita error:', error);
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    console.error('insertReceita exception:', err);
    return { data: null, error: err };
  }
}

/* ====== insert comentario ====== */
async function insertComentario(com) {
  if (!db) return { error: 'no-db' };
  try {
    const { data, error } = await db.from('comentarios').insert(com).select().single();
    if (error) {
      console.error('insertComentario error:', error);
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    console.error('insertComentario exception:', err);
    return { data: null, error: err };
  }
}

/* ====== upload imagem ====== */
async function uploadImagem(file, title) {
  if (!file) return null;
  if (!db) return URL.createObjectURL(file);

  const slug = (title || 'imagem').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const ext = file.name && file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
  const path = `uploads/${Date.now()}-${slug}${ext}`;

  try {
    const { error } = await db.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      console.error('uploadImagem upload error:', error);
      return null;
    }

    // getPublicUrl is synchronous in v2 client; returns { data: { publicUrl } }
    const { data } = db.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data?.publicUrl ?? null;
  } catch (err) {
    console.error('uploadImagem exception:', err);
    return null;
  }
}

/* ====== Auth UI helpers (open/close modals) ====== */
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

/* ====== Auth actions ====== */
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
  if (error) {
    if (msgEl) { msgEl.textContent = error.message; msgEl.classList.remove('hidden'); msgEl.classList.add('error'); }
    submitBtn && (submitBtn.disabled = false);
    return;
  }

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
  if (error) {
    if (msgEl) { msgEl.textContent = error.message; msgEl.classList.remove('hidden'); msgEl.classList.add('error'); }
    submitBtn && (submitBtn.disabled = false);
    return;
  }

  const { error: signInError } = await db.auth.signInWithPassword({ email, password });
  if (signInError) {
    if (msgEl) { msgEl.textContent = signInError.message; msgEl.classList.remove('hidden'); msgEl.classList.add('error'); }
    submitBtn && (submitBtn.disabled = false);
    return;
  }

  closeAuth();
  state.receitas = await fetchReceitas();
  renderReceitas();
  submitBtn && (submitBtn.disabled = false);
}

/* ====== Render receitas (preserva seu markup) ====== */
function renderReceitas() {
  const grid = document.getElementById('receitas-grid');
  const empty = document.getElementById('empty-state');
  if (!grid || !empty) return;

  let items = state.receitas;
  if (state.filtroCategoria) items = items.filter(r => r.categoria === state.filtroCategoria);
  if (state.busca) items = items.filter(r => (r.titulo || '').toLowerCase().includes(state.busca.toLowerCase()));

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
        <div class="card-meta"><span>${r.categoria}</span><span>•</span><span>${r.autor || ''}</span></div>
        <div class="card-actions"><button class="btn btn-secondary open-recipe" data-id="${r.id}"><i class="fa-solid fa-eye"></i> Ver</button><button class="btn btn-primary add-comment" data-id="${r.id}"><i class="fa-solid fa-comment"></i> Comentar</button></div>
      </div>
    </article>
  `).join('');

  // event binding
  grid.querySelectorAll('.open-recipe').forEach(b => b.addEventListener('click', () => openRecipe(b.dataset.id)));
  grid.querySelectorAll('.add-comment').forEach(b => b.addEventListener('click', () => openRecipe(b.dataset.id)));
}

/* ====== abrir receita ====== */
async function openRecipe(id) {
  const r = state.receitas.find(x => x.id == id);
  if (!r) return;
  state.receitaAtual = r;

  const coverEl = document.getElementById('recipe-cover');
  const titleEl = document.getElementById('recipe-title');
  const categoryEl = document.getElementById('recipe-category');
  const authorEl = document.getElementById('recipe-author');
  const ingredientsEl = document.getElementById('recipe-ingredients');
  const methodEl = document.getElementById('recipe-method');

  if (coverEl) coverEl.style.backgroundImage = `url('${coverFor(r)}')`;
  if (titleEl) titleEl.textContent = r.titulo;
  if (categoryEl) categoryEl.textContent = r.categoria;
  if (authorEl) authorEl.textContent = r.autor;
  if (ingredientsEl) ingredientsEl.textContent = r.ingredientes;
  if (methodEl) methodEl.textContent = r.modo_preparo;

  document.getElementById('recipe-modal')?.classList.remove('hidden');
  const comments = await fetchComentarios(r.id);
  renderComentarios(comments);
}

/* ====== render comentarios ====== */
function renderComentarios(comments) {
  const list = document.getElementById('comments-list');
  if (!list) return;
  list.innerHTML = (comments || []).map(c => `
    <div class="comment">
      <div class="comment-user">${c.usuario}</div>
      <div class="comment-text">${c.texto}</div>
    </div>
  `).join('');
}

/* ====== fechar receita ====== */
function closeRecipe() {
  document.getElementById('recipe-modal')?.classList.add('hidden');
  state.receitaAtual = null;
}

/* ====== abrir/fechar novo ====== */
function openNewRecipe() { document.getElementById('new-recipe-modal')?.classList.remove('hidden'); }
function closeNewRecipe() { document.getElementById('new-recipe-modal')?.classList.add('hidden'); }

/* ====== submit new recipe (mantendo sua lógica) ====== */
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
  if (error && error !== 'no-db') {
    // show friendly message
    console.error('submitNewRecipe insert error', error);
    alert('Erro ao salvar receita: ' + (error.message || JSON.stringify(error)));
    return;
  }
  if (data) state.receitas.unshift(data);
  if (!db) {
    const id = Date.now().toString();
    state.receitas.unshift({ ...rec, id });
  }

  renderReceitas();
  closeNewRecipe();
  e.target.reset();
}

/* ====== submit comment ====== */
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
  if (error && error !== 'no-db') {
    console.error('submitComment error', error);
    alert('Erro ao enviar comentário');
    return;
  }

  const comments = await fetchComentarios(state.receitaAtual.id);
  renderComentarios(comments);
  if (!db) {
    renderComentarios([{ ...com }]);
  }
  document.getElementById('comment-form')?.reset();
}

/* ====== boot (event wiring) ====== */
async function boot() {
  document.getElementById('buscar-btn')?.addEventListener('click', () => { state.busca = document.getElementById('busca-input').value; renderReceitas(); });
  document.getElementById('categoria-filter')?.addEventListener('change', e => { state.filtroCategoria = e.target.value; renderReceitas(); });
  document.getElementById('open-new-recipe')?.addEventListener('click', e => { e.preventDefault(); openNewRecipe(); });
  document.getElementById('close-new-recipe')?.addEventListener('click', closeNewRecipe);
  document.getElementById('close-recipe-modal')?.addEventListener('click', closeRecipe);
  const recipeOverlay = document.getElementById('recipe-modal');
  recipeOverlay?.addEventListener('click', e => { if (e.target === recipeOverlay) closeRecipe(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !recipeOverlay?.classList.contains('hidden')) closeRecipe(); });

  document.getElementById('new-recipe-form')?.addEventListener('submit', submitNewRecipe);
  document.getElementById('comment-form')?.addEventListener('submit', submitComment);

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
    try {
      const { data } = await db.auth.getSession();
      const session = data?.session;
      if (!session) { openLogin(); } // if you want to force login on boot
    } catch (err) {
      console.warn('boot auth getSession err', err);
    }
  }

  state.receitas = await fetchReceitas();
  renderReceitas();
}

/* ====== start ====== */
document.addEventListener('DOMContentLoaded', boot);
