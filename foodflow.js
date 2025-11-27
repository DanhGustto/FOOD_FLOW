const config = {
  url: 'https://yckkxwbgeppeccdkzjdz.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlja2t4d2JnZXBwZWNjZGt6amR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NzE1MDIsImV4cCI6MjA3OTA0NzUwMn0.3NAzr8mdGyuJnKadwBjHYjP16T_wrkIPZdIYpU4v2fI',
  bucket: 'receitas'
};

const sb = window.supabase.createClient(config.url, config.key);

const defaults = [
  { id: '1', titulo: 'Bolo de Cenoura', autor: 'Ana', categoria: 'sobremesa', ingredientes: 'Cenoura\nFarinha\nAçúcar\nOvos\nÓleo', modo_preparo: 'Misture tudo e asse 40min a 180ºC', imagem: 'img/boloCenoura.jpg', criado_em: new Date().toISOString() },
  { id: '2', titulo: 'Lasanha Bolonhesa', autor: 'Carlos', categoria: 'prato-principal', ingredientes: 'Massa\nMolho\nCarne Moída\nQueijo', modo_preparo: 'Forno 30min', imagem: 'img/lasanha.jpg', criado_em: new Date().toISOString() },
  { id: '3', titulo: 'Bruschetta', autor: 'Julia', categoria: 'entrada', ingredientes: 'Pão\nTomate\nManjericão\nAzeite', modo_preparo: 'Toste e cubra', imagem: 'img/bruschetta.jpg', criado_em: new Date().toISOString() }
];

const state = {
  receitas: [],
  filtro: '',
  busca: '',
  atual: null
};

// UPLOAD imagem para Storage
async function uploadImagem(file, title) {
  if (!file) return null;
  if (!sb) return URL.createObjectURL(file);

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const ext = file.name.slice(file.name.lastIndexOf('.'));
  const path = `uploads/${Date.now()}-${slug}${ext}`;

  const { error } = await sb.storage.from(config.bucket).upload(path, file, {
    upsert: true,
    contentType: file.type
  });

  if (error) {
    console.error("Storage upload error:", error);
    return null;
  }

  const { data } = sb.storage.from(config.bucket).getPublicUrl(path);
  return data.publicUrl;
}

// INSERT receita no banco
async function saveReceita(rec) {
  if (!sb) return { ...rec, id: Date.now().toString(), criado_em: new Date().toISOString() };
  const { data, error } = await sb.from('receitas').insert(rec).select().single();
  if (error) {
    console.error("Insert receita error:", error);
    return null;
  }
  return data;
}

// SELECT receitas
async function loadReceitas() {
  if (!sb) return defaults;
  const { data, error } = await sb.from('receitas').select('*').order('criado_em', { ascending: false });
  if (error) {
    console.error("Select receitas error:", error);
    return defaults;
  }
  return [...defaults, ...data];
}

// SELECT comentários
async function loadComentarios(id) {
  if (!sb) return [];
  const { data, error } = await sb.from('comentarios').select('*').eq('id_receita', id).order('criado_em', { ascending: false });
  if (error) {
    console.error("Select comentarios error:", error);
    return [];
  }
  return data;
}

// INSERT comentário
async function saveComentario(com) {
  if (!sb) return com;
  const { data, error } = await sb.from('comentarios').insert(com).select().single();
  if (error) {
    console.error("Insert comentario error:", error);
    return null;
  }
  return data;
}

function renderReceitas() {
  const grid = document.getElementById('receitas-grid');
  const empty = document.getElementById('empty-state');
  let items = state.receitas;

  if (state.filtro) items = items.filter(r => r.categoria === state.filtro);
  if (state.busca) items = items.filter(r => r.titulo.toLowerCase().includes(state.busca.toLowerCase()));

  if (!items.length) {
    empty.classList.remove('hidden');
    grid.innerHTML = '';
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = items.map(r => `
    <article class="card">
      <div class="card-cover" style="background-image:url('${r.imagem || ''}')"></div>
      <div class="card-body">
        <div class="card-title">${r.titulo}</div>
        <div class="card-meta"><span>${r.categoria}</span> • <span>${r.autor}</span></div>
        <div class="card-actions">
          <button class="open-recipe" data-id="${r.id}">👁 Ver</button>
          <button class="add-comment" data-id="${r.id}">💬 Comentar</button>
        </div>
      </div>
    </article>
  `).join('');

  document.querySelectorAll('.open-recipe').forEach(btn => 
    btn.addEventListener('click', () => openRecipe(btn.dataset.id))
  );

  document.querySelectorAll('.add-comment').forEach(btn => 
    btn.addEventListener('click', () => openComment(btn.dataset.id))
  );
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
  state.atual = null;
}

function openComment(id) {
  state.idComentar = id;
  document.getElementById('comment-modal')?.classList.remove('hidden');
}

async function openRecipe(id) {
  const r = state.receitas.find(x => x.id == id);
  if (!r) return;
  state.atual = r;
  document.getElementById('recipe-cover').style.backgroundImage = `url('${r.imagem || ''}')`;
  document.getElementById('recipe-title').textContent = r.titulo;
  document.getElementById('recipe-category').textContent = r.categoria;
  document.getElementById('recipe-author').textContent = r.autor;
  document.getElementById('recipe-ingredients').textContent = r.ingredientes;
  document.getElementById('recipe-method').textContent = r.modo_preparo;
  document.getElementById('recipe-modal').classList.remove('hidden');

  const coms = await loadComentarios(r.id);
  renderComentarios(coms);
}

document.getElementById('close-recipe-modal')?.addEventListener('click', closeRecipe);

document.getElementById('send-comment')?.addEventListener('click', async () => {
  const u = document.getElementById('comment-user').value.trim();
  const t = document.getElementById('comment-text').value.trim();
  if (!u || !t || !state.idComentar) return;

  const saved = await saveComentario({ id_receita: state.idComentar, usuario: u, texto: t });
  if (saved && state.atual) {
    const coms = await loadComentarios(state.atual.id);
    renderComentarios(coms);
  }
  document.getElementById('comment-modal')?.classList.add('hidden');
  document.getElementById('comment-form').reset();
});

// SUBMIT nova receita
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

  const saved = await saveReceita(rec);
  if (saved) state.receitas.unshift(saved); else state.receitas.unshift({ ...rec, id: Date.now().toString(), criado_em:new Date().toISOString() });

  renderReceitas();
  document.getElementById('new-recipe-modal').classList.add('hidden');
  e.target.reset();
}

document.getElementById('new-recipe-form')?.addEventListener('submit', submitNewRecipe);

// BOOT do site
document.addEventListener('DOMContentLoaded', async () => {
  state.receitas = await loadReceitas();
  renderReceitas();
});

