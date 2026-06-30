import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Read package.json for repository URL
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'))

console.log('🚀 Deploying Monitor Dashboard to GitHub Pages...')

// Get the GitHub repo URL - user will need to set this
const repoUrl = process.env.GITHUB_REPO_URL || 'https://github.com/anisoni129/monitor-dashboard.git'

// Build the project
try {
  console.log('📦 Building project...')
  execSync('npm run build', { cwd: __dirname, stdio: 'inherit' })
  console.log('✅ Build complete!')
  
  // Initialize git repo if not already initialized
  try {
    execSync('git init', { cwd: __dirname, stdio: 'inherit' })
    console.log('📝 Git repository initialized')
  } catch {
    console.log('ℹ️  Git repository already exists')
  }

  // Configure git
  execSync('git config user.name "deploy-script"', { cwd: __dirname })
  execSync('git config user.email "script@example.com"', { cwd: __dirname })
  
  // Add and commit files
  execSync('git add .', { cwd: __dirname, stdio: 'inherit' })
  execSync('git commit -m "Initial commit for GitHub Pages deployment"', { cwd: __dirname, stdio: 'inherit' })
  
  // Set remote and push
  execSync('git checkout -b gh-pages', { cwd: __dirname, stdio: 'inherit' })
  try {
    execSync(`git remote add origin ${repoUrl}`, { cwd: __dirname })
  } catch {
    execSync(`git remote set-url origin ${repoUrl}`, { cwd: __dirname })
  }
  
  console.log('📤 Pushing to GitHub...')
  execSync('git push -u origin gh-pages --force', { cwd: __dirname, stdio: 'inherit' })
  
  console.log('\n✅ Deployment complete!')
  console.log(`🌐 Your site is live at: https://anisoni129.github.io/monitor-dashboard/`)
  
} catch (error) {
  console.error('❌ Deployment failed:', error.message)
  process.exit(1)
}