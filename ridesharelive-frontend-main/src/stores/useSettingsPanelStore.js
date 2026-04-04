import { create } from "zustand";
import { DEFAULT_DRAWER_SNAPSHOT } from "../utils/settingsDrawerState";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function updateSectionField(draft, section, field, value) {
  return {
    ...draft,
    [section]: {
      ...draft[section],
      [field]: value,
    },
  };
}

export const useSettingsPanelStore = create((set, get) => ({
  draft: clone(DEFAULT_DRAWER_SNAPSHOT),
  baseline: clone(DEFAULT_DRAWER_SNAPSHOT),
  defaults: clone(DEFAULT_DRAWER_SNAPSHOT),
  expanded: {
    profileEditor: false,
    trustedContacts: true,
    refundHistory: false,
  },
  isHydrating: false,
  isSaving: false,
  isDirty: false,
  toast: null,
  saveCounter: 0,
  hydrate(snapshot, defaultSnapshot) {
    const nextSnapshot = clone(snapshot);
    set({
      draft: nextSnapshot,
      baseline: clone(snapshot),
      defaults: clone(defaultSnapshot || snapshot),
      isHydrating: true,
      isDirty: false,
      isSaving: false,
      toast: null,
      expanded: {
        profileEditor: false,
        trustedContacts: true,
        refundHistory: false,
      },
    });
  },
  finishHydration() {
    set({ isHydrating: false });
  },
  setField(section, field, value) {
    const { draft } = get();
    set({
      draft: updateSectionField(draft, section, field, value),
      isDirty: true,
    });
  },
  toggleField(section, field) {
    const { draft } = get();
    set({
      draft: updateSectionField(draft, section, field, !draft?.[section]?.[field]),
      isDirty: true,
    });
  },
  setList(section, field, nextList) {
    const { draft } = get();
    set({
      draft: updateSectionField(draft, section, field, nextList),
      isDirty: true,
    });
  },
  addListItem(section, field, value) {
    const nextValue = String(value || "").trim();
    if (!nextValue) {
      return;
    }

    const { draft } = get();
    const currentItems = Array.isArray(draft?.[section]?.[field]) ? draft[section][field] : [];
    const nextItems = [...currentItems, nextValue].slice(0, 6);
    set({
      draft: updateSectionField(draft, section, field, nextItems),
      isDirty: true,
    });
  },
  removeListItem(section, field, index) {
    const { draft } = get();
    const currentItems = Array.isArray(draft?.[section]?.[field]) ? draft[section][field] : [];
    const nextItems = currentItems.filter((_, itemIndex) => itemIndex !== index);
    set({
      draft: updateSectionField(draft, section, field, nextItems),
      isDirty: true,
    });
  },
  resetToBaseline() {
    const { baseline } = get();
    set({
      draft: clone(baseline),
      isDirty: false,
      toast: null,
    });
  },
  resetToDefaults() {
    const { defaults } = get();
    set({
      draft: clone(defaults),
      isDirty: true,
      toast: null,
    });
  },
  setSaving(value) {
    set({ isSaving: value });
  },
  markSaved(snapshot, message = "Settings saved") {
    const nextSnapshot = clone(snapshot);
    set((state) => ({
      draft: nextSnapshot,
      baseline: clone(snapshot),
      isSaving: false,
      isDirty: false,
      toast: {
        id: Date.now(),
        tone: "success",
        message,
      },
      saveCounter: state.saveCounter + 1,
    }));
  },
  markSaveError(message) {
    set({
      isSaving: false,
      toast: {
        id: Date.now(),
        tone: "error",
        message,
      },
    });
  },
  dismissToast() {
    set({ toast: null });
  },
  toggleExpanded(key) {
    set((state) => ({
      expanded: {
        ...state.expanded,
        [key]: !state.expanded[key],
      },
    }));
  },
}));
