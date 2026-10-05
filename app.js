(() => {
  'use strict';

  const STORAGE_KEY = 'tabletnitsa.v1';
  const groups = [['breakfast', 'Завтрак'], ['lunch', 'Обед'], ['dinner', 'Ужин']];
  const meals = document.getElementById('meals');
  const editButton = document.getElementById('edit');
  const today = document.getElementById('today');
  let editing = false;
  let midnightTimer;
  let storage;

  function localDay(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function storageFailed() {
    document.getElementById('storage-warning').hidden = false;
  }

  const state = { date: localDay(), meals: { breakfast: [], lunch: [], dinner: [] } };
  try {
    storage = window.localStorage;
    const probe = `${STORAGE_KEY}.probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    const saved = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
    if (saved && saved.meals) {
      state.date = typeof saved.date === 'string' ? saved.date : '';
      for (const [key] of groups) {
        const items = Array.isArray(saved.meals[key]) ? saved.meals[key] : [];
        state.meals[key] = items.filter(item => item && typeof item.name === 'string' && item.name.trim())
          .map(item => ({ name: item.name.trim(), checked: item.checked === true }));
      }
    }
  } catch {
    storageFailed();
  }

  function save() {
    try {
      if (!storage) throw new Error('Storage unavailable');
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      storageFailed();
    }
  }

  function checkDay() {
    const now = new Date();
    const date = localDay(now);
    if (state.date !== date) {
      state.date = date;
      for (const [key] of groups) state.meals[key].forEach(item => { item.checked = false; });
      meals.querySelectorAll('.check').forEach(box => { box.checked = false; });
      save();
    }
    today.dateTime = date;
    today.textContent = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function scheduleMidnight() {
    clearTimeout(midnightTimer);
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    midnightTimer = setTimeout(() => { checkDay(); scheduleMidnight(); }, Math.max(100, next - now + 50));
  }

  function resume() { checkDay(); scheduleMidnight(); }

  function iconButton(kind, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `icon-button ${kind}`;
    button.setAttribute('aria-label', label);
    button.title = label;
    // Fixed markup only; medicine names are always assigned as text or values.
    button.innerHTML = kind === 'delete'
      ? '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>'
      : '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
    return button;
  }

  function fitTextarea(field) {
    field.style.height = 'auto';
    field.style.height = `${field.scrollHeight + 2}px`;
  }

  function render() {
    meals.replaceChildren();
    meals.classList.toggle('editing', editing);
    editButton.textContent = editing ? 'Готово' : 'Редактировать';
    editButton.setAttribute('aria-pressed', String(editing));

    for (const [key, title] of groups) {
      const card = document.createElement('section');
      card.className = 'card';
      card.dataset.meal = key;
      const heading = document.createElement('h2');
      heading.id = `heading-${key}`;
      heading.textContent = title;
      card.setAttribute('aria-labelledby', heading.id);
      card.append(heading);
      const list = document.createElement('ul');
      list.className = 'list';

      state.meals[key].forEach((item, index) => {
        const row = document.createElement('li');
        row.className = 'row';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.className = 'check';
        box.id = `check-${key}-${index}`;
        box.checked = item.checked;
        box.setAttribute('aria-label', `Принято: ${item.name}`);
        box.addEventListener('change', () => {
          const checked = box.checked;
          checkDay();
          item.checked = checked;
          box.checked = checked;
          save();
        });
        row.append(box);

        if (editing) {
          const field = document.createElement('textarea');
          field.className = 'name-editor';
          field.rows = 1;
          field.value = item.name;
          field.setAttribute('aria-label', `Название лекарства — ${title}`);
          field.addEventListener('input', () => {
            checkDay();
            const name = field.value.trim();
            if (name) {
              item.name = name;
              box.setAttribute('aria-label', `Принято: ${name}`);
              save();
            }
            fitTextarea(field);
          });
          field.addEventListener('blur', () => {
            field.value = item.name;
            fitTextarea(field);
          });
          field.addEventListener('keydown', event => {
            if (event.key === 'Enter') { event.preventDefault(); field.blur(); }
          });
          const remove = iconButton('delete', `Удалить лекарство: ${item.name}`);
          remove.addEventListener('click', () => {
            checkDay();
            state.meals[key].splice(index, 1);
            save();
            render();
            const next = cardFor(key).querySelectorAll('.delete')[index] || cardFor(key).querySelector('.add-input');
            next.focus();
          });
          row.append(field, remove);
        } else {
          const label = document.createElement('label');
          label.className = 'name';
          label.htmlFor = box.id;
          label.textContent = item.name;
          row.append(label);
        }
        list.append(row);
      });

      card.append(list);
      if (!state.meals[key].length) {
        const empty = document.createElement('p');
        empty.className = 'empty';
        empty.textContent = 'Нет лекарств';
        card.append(empty);
      }

      if (editing) {
        const form = document.createElement('form');
        form.className = 'add-form';
        const input = document.createElement('input');
        input.className = 'add-input';
        input.type = 'text';
        input.placeholder = 'Название лекарства';
        input.setAttribute('aria-label', `Добавить лекарство — ${title}`);
        input.autocomplete = 'off';
        const add = iconButton('add', `Добавить лекарство — ${title}`);
        add.type = 'submit';
        form.append(input, add);
        form.addEventListener('submit', event => {
          event.preventDefault();
          const name = input.value.trim();
          if (!name) { input.focus(); return; }
          checkDay();
          state.meals[key].push({ name, checked: false });
          save();
          render();
          cardFor(key).querySelector('.add-input').focus();
        });
        card.append(form);
      }
      meals.append(card);
    }
    meals.querySelectorAll('.name-editor').forEach(fitTextarea);
  }

  function cardFor(key) { return meals.querySelector(`[data-meal="${key}"]`); }
  editButton.addEventListener('click', () => { checkDay(); editing = !editing; render(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) resume(); });
  window.addEventListener('focus', resume);
  window.addEventListener('pageshow', resume);
  window.addEventListener('resize', () => meals.querySelectorAll('.name-editor').forEach(fitTextarea));
  setInterval(checkDay, 15000);
  checkDay();
  render();
  scheduleMidnight();
})();
