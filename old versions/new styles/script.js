// Theme toggle functionality
const themeToggle = document.getElementById("themeToggle")
const body = document.body

// Load saved theme or default to light
const savedTheme = localStorage.getItem("theme") || "light"
body.className = savedTheme
updateThemeIcon()

themeToggle.addEventListener("click", () => {
  const currentTheme = body.className
  const newTheme = currentTheme === "light" ? "dark" : "light"

  body.className = newTheme
  localStorage.setItem("theme", newTheme)
  updateThemeIcon()
})

function updateThemeIcon() {
  const icon = themeToggle.querySelector("i")
  if (body.className === "dark") {
    icon.setAttribute("data-lucide", "sun")
  } else {
    icon.setAttribute("data-lucide", "moon")
  }
  // Reinitialize icons after changing
  window.lucide.createIcons()
}

// Tab switching functionality
const navButtons = document.querySelectorAll(".nav-button")
const tabContents = document.querySelectorAll(".tab-content")

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const targetTab = button.getAttribute("data-tab")

    // Remove active class from all nav buttons and tab contents
    navButtons.forEach((btn) => btn.classList.remove("active"))
    tabContents.forEach((content) => content.classList.remove("active"))

    // Add active class to clicked button and corresponding tab
    button.classList.add("active")
    document.getElementById(targetTab).classList.add("active")
  })
})

// Form interactions
document.addEventListener("DOMContentLoaded", () => {
  // Add click handlers for buttons
  const buttons = document.querySelectorAll(".button")
  buttons.forEach((button) => {
    button.addEventListener("click", (e) => {
      // Add ripple effect or other interactions here
      console.log("Button clicked:", button.textContent.trim())
    })
  })

  // Add change handlers for switches and checkboxes
  const switches = document.querySelectorAll('input[type="checkbox"]')
  switches.forEach((switchEl) => {
    switchEl.addEventListener("change", (e) => {
      console.log("Setting changed:", e.target.checked)
    })
  })

  // Add input handlers for form fields
  const inputs = document.querySelectorAll("input, textarea, select")
  inputs.forEach((input) => {
    input.addEventListener("change", (e) => {
      console.log("Input changed:", e.target.value)
    })
  })
})

// Smooth scrolling for better UX
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault()
    const target = document.querySelector(this.getAttribute("href"))
    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }
  })
})

// Add loading states for buttons
function addLoadingState(button, duration = 2000) {
  const originalText = button.innerHTML
  button.innerHTML = '<i data-lucide="loader-2"></i> Loading...'
  button.disabled = true

  setTimeout(() => {
    button.innerHTML = originalText
    button.disabled = false
    window.lucide.createIcons()
  }, duration)
}

// Example usage for sync button
document.addEventListener("click", (e) => {
  if (e.target.closest(".button") && e.target.textContent.includes("Sync")) {
    addLoadingState(e.target.closest(".button"))
  }
})
