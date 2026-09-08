<template>
  <OperationsConsoleV2 v-if="isDemo" />
  <AwardShowcase v-else />
</template>

<script setup>
import OperationsConsoleV2 from './OperationsConsoleV2.vue';
import AwardShowcase from './AwardShowcase.vue';

const params = new URLSearchParams(window.location.search);
const isDemo = params.get('mode') === 'demo';
</script>
