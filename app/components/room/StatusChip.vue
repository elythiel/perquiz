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
  <BaseChip :tone="inPlay ? 'torch' : 'edge'">
    {{ inPlay ? t('roomStatus.inPlay') : t('roomStatus.notInPlay') }}
  </BaseChip>
</template>
