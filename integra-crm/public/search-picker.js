'use strict';

const searchPicker = {
  props: {
    modelValue: { default: '' },
    options: { type: Array, default: () => [] },
    idKey: { type: String, required: true },
    labelKeys: { type: Array, required: true },
    statusKey: { type: String, default: '' },
    placeholder: { type: String, default: 'Buscar o seleccionar…' },
    required: { type: Boolean, default: false },
    emptyLabel: { type: String, default: '' }
  },
  emits: ['update:modelValue', 'search', 'selected'],
  data() { return { text: '', open: false, editing: false }; },
  computed: {
    selected() {
      return this.options.find((item) => Number(item[this.idKey]) === Number(this.modelValue));
    },
    shown() {
      if (!this.editing || !this.text.trim()) return this.options;
      const q = this.text.trim().toLocaleLowerCase('es');
      return this.options.filter((item) => this.label(item).toLocaleLowerCase('es').includes(q));
    }
  },
  watch: {
    modelValue() { if (!this.open) this.text = this.selected ? this.label(this.selected) : ''; },
    options() { if (!this.open && this.selected) this.text = this.label(this.selected); }
  },
  mounted() { if (this.selected) this.text = this.label(this.selected); },
  methods: {
    label(item) { return this.labelKeys.map((key) => item[key]).filter(Boolean).join(' · '); },
    statusClass(value) {
      return ({ DISPONIBLE: 'status-available', VENDIDA: 'status-sold',
        REVISION: 'status-review', EN_SERVICIO: 'status-service',
        ENTREGADA: 'status-delivered', BAJA: 'status-retired' })[value] || 'neutral';
    },
    type(event) {
      this.text = event.target.value;
      this.editing = true;
      this.open = true;
      this.$emit('update:modelValue', '');
      this.$emit('search', this.text);
      event.target.setCustomValidity(this.required ? 'Selecciona una opción de la lista' : '');
    },
    choose(item) {
      this.text = this.label(item);
      this.editing = false;
      this.open = false;
      this.$emit('update:modelValue', item[this.idKey]);
      this.$emit('selected', item[this.idKey]);
      this.$emit('search', '');
      this.$refs.entry.setCustomValidity('');
    },
    clear() {
      this.text = '';
      this.editing = false;
      this.open = false;
      this.$emit('update:modelValue', '');
      this.$emit('search', '');
      this.$refs.entry.setCustomValidity('');
    },
    close() {
      this.open = false;
      this.editing = false;
      this.text = this.selected ? this.label(this.selected) : '';
      this.$refs.entry.setCustomValidity('');
    },
    toggle() {
      if (this.open) this.close();
      else {
        this.$refs.entry.focus();
        this.open = true;
        this.editing = false;
      }
    }
  },
  template: `
    <div class="search-picker" @keydown.esc="close">
      <div class="search-picker-control">
        <input ref="entry" :value="text" :placeholder="placeholder" :required="required"
          role="combobox" aria-autocomplete="list" :aria-expanded="open"
          autocomplete="off" @focus="open = true; editing = false"
          @input="type" @blur="close">
        <span v-if="statusKey && selected" :class="['status-chip', statusClass(selected[statusKey])]">{{ selected[statusKey] }}</span>
        <button type="button" :aria-label="open ? 'Cerrar opciones' : 'Ver opciones'"
          @mousedown.prevent @click="toggle">⌄</button>
      </div>
      <div v-if="open" class="search-picker-options" role="listbox">
        <button v-if="!required && modelValue" type="button" role="option" @mousedown.prevent="clear" @touchend.prevent="clear">{{ emptyLabel || 'Sin selección' }}</button>
        <button v-for="item in shown" :key="item[idKey]" type="button" role="option"
          :aria-selected="Number(item[idKey]) === Number(modelValue)"
          @mousedown.prevent="choose(item)" @touchend.prevent="choose(item)"><span>{{ label(item) }}</span><span v-if="statusKey" :class="['status-chip', statusClass(item[statusKey])]">{{ item[statusKey] }}</span></button>
        <p v-if="!shown.length" class="muted">No hay coincidencias. Escribe un código o nombre para buscar.</p>
      </div>
    </div>`
};
