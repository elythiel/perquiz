<script setup lang="ts">
defineProps<{ inPlay: boolean }>()

const { t } = useI18n()
</script>

<template>
  <!--
    Drawn by « Ma pièce » and by the dashboard, hence its own component and its
    own namespace in the locale file: the same fact, said the same way on both
    screens, is the whole point of a status chip.
  -->
  <p
    class="rounded-lg px-3 py-1.5 font-mono text-label tracking-label whitespace-nowrap uppercase"
    :class="inPlay ? 'bg-torch/10 text-torch-ink' : 'border border-edge-strong bg-panel text-text-muted'"
  >
    {{ inPlay ? t('roomStatus.inPlay') : t('roomStatus.notInPlay') }}
  </p>
</template>
