(() => {
  'use strict'

  const header = document.querySelector('.site-header')
  const mobileMenu = document.querySelector('.main-nav')

  document.querySelector('.mobile-trigger')?.addEventListener('click', () => {
    mobileMenu?.classList.toggle('open')
  })

  document.querySelectorAll('.footer-title').forEach((button) => {
    button.addEventListener('click', () => {
      button.closest('.footer-group')?.querySelector('.footer-list')?.classList.toggle('expanded')
    })
  })

  addEventListener('scroll', () => header?.classList.toggle('is-fixed', scrollY > 90), { passive: true })
})()
