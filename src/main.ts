import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { checkForUpdate } from './lib/update.svelte'

const app = mount(App, {
  target: document.getElementById('app')!,
})

if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate()
  })
}

navigator.storage?.persist?.()

export default app
