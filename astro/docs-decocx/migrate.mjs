import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname, basename, extname } from 'path';
import { existsSync } from 'fs';

const SOURCE_DIR = '/home/igoramf/projects/deco/docs';
const DEST_DIR = '/home/igoramf/projects/deco/docs-decocx/client/src/content';

// Mapping of source locale to destination locale
const LOCALE_MAP = {
  'en': 'en',
  'pt': 'pt-br'
};

// Generate navigation order list
const navigationPaths = [];

// Extract title from content (first # heading) or filename
function extractTitle(content, filename) {
  // Try to find first # heading
  const match = content.match(/^#\s+(.+)$/m);
  if (match) {
    return match[1].trim();
  }

  // Fallback: convert filename to title
  const name = basename(filename, extname(filename));
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Transform frontmatter to include title
function transformFrontmatter(content, filename) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

  if (!frontmatterMatch) {
    // No frontmatter, create one
    const title = extractTitle(content, filename);
    return `---\ntitle: "${title}"\ndescription: ""\n---\n\n${content}`;
  }

  const frontmatter = frontmatterMatch[1];
  const restContent = content.slice(frontmatterMatch[0].length);

  // Check if title already exists
  if (frontmatter.includes('title:')) {
    return content;
  }

  // Extract title and add it
  const title = extractTitle(restContent, filename);
  const escapedTitle = title.replace(/"/g, '\\"');

  return `---\ntitle: "${escapedTitle}"\n${frontmatter}\n---${restContent}`;
}

// Convert <Frame><img .../></Frame> to markdown image
function convertFrameToMarkdown(content) {
  // Pattern: <Frame><img src="..." alt="..." .../></Frame>
  // or <Frame><img src="..." alt="..."></img></Frame>
  const framePattern = /<Frame>\s*<img\s+src="([^"]+)"(?:\s+alt="([^"]*)")?[^>]*\/?>\s*(?:<\/img>)?\s*<\/Frame>/g;

  return content.replace(framePattern, (match, src, alt = '') => {
    return `![${alt}](${src})`;
  });
}

// Convert blockquotes with special markers to Callout components
function convertBlockquotesToCallout(content) {
  // Pattern for > **Tip**: ... or > **Warning**: ... etc.
  const patterns = [
    { pattern: /^>\s*\*\*Tip\*\*:\s*(.+)$/gm, type: 'tip' },
    { pattern: /^>\s*\*\*Important\*\*:\s*(.+)$/gm, type: 'warning' },
    { pattern: /^>\s*\*\*Warning\*\*:\s*(.+)$/gm, type: 'warning' },
    { pattern: /^>\s*\*\*Note\*\*:\s*(.+)$/gm, type: 'info' },
    { pattern: /^>\s*\*\*Example\*\*:\s*(.+)$/gm, type: 'info' },
  ];

  let result = content;
  let needsImport = false;

  for (const { pattern, type } of patterns) {
    if (pattern.test(result)) {
      needsImport = true;
      result = result.replace(pattern, (match, text) => {
        return `<Callout type="${type}">\n  ${text.trim()}\n</Callout>`;
      });
      // Reset lastIndex for global regex
      pattern.lastIndex = 0;
    }
  }

  // Also handle multi-line blockquotes
  // > **Tip**:
  // > Line 1
  // > Line 2
  const multilinePatterns = [
    { marker: '**Tip**:', type: 'tip' },
    { marker: '**Important**:', type: 'warning' },
    { marker: '**Warning**:', type: 'warning' },
    { marker: '**Note**:', type: 'info' },
    { marker: '**Example**:', type: 'info' },
  ];

  for (const { marker, type } of multilinePatterns) {
    const escapedMarker = marker.replace(/\*/g, '\\*');
    const multilinePattern = new RegExp(
      `^>\\s*${escapedMarker}\\s*\\n((?:>.*\\n?)+)`,
      'gm'
    );

    if (multilinePattern.test(result)) {
      needsImport = true;
      result = result.replace(multilinePattern, (match, lines) => {
        const cleanedLines = lines
          .split('\n')
          .map(line => line.replace(/^>\s?/, '').trim())
          .filter(line => line)
          .join('\n  ');
        return `<Callout type="${type}">\n  ${cleanedLines}\n</Callout>`;
      });
      multilinePattern.lastIndex = 0;
    }
  }

  return { content: result, needsCalloutImport: needsImport };
}

// Add Callout import if needed
function addCalloutImport(content, needsImport) {
  if (!needsImport) return content;

  // Check if import already exists
  if (content.includes('import Callout')) {
    return content;
  }

  // Find the end of frontmatter
  const frontmatterEnd = content.indexOf('---', 4);
  if (frontmatterEnd === -1) return content;

  const afterFrontmatter = frontmatterEnd + 3;
  const before = content.slice(0, afterFrontmatter);
  const after = content.slice(afterFrontmatter);

  const importStatement = '\n\nimport Callout from "../../components/ui/Callout.astro";';

  return before + importStatement + after;
}

// Process a single MDX file
async function processFile(sourcePath, destPath) {
  let content = await readFile(sourcePath, 'utf-8');
  const filename = basename(sourcePath);

  // Transform frontmatter (add title)
  content = transformFrontmatter(content, filename);

  // Convert Frame tags to markdown images
  content = convertFrameToMarkdown(content);

  // Convert blockquotes to Callout components
  const { content: transformedContent, needsCalloutImport } = convertBlockquotesToCallout(content);
  content = transformedContent;

  // Add Callout import if needed
  content = addCalloutImport(content, needsCalloutImport);

  // Create directory if needed
  const destDir = dirname(destPath);
  if (!existsSync(destDir)) {
    await mkdir(destDir, { recursive: true });
  }

  // Write the file
  await writeFile(destPath, content, 'utf-8');
  console.log(`Migrated: ${sourcePath} -> ${destPath}`);
}

// Recursively get all MDX files
async function getMdxFiles(dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await getMdxFiles(fullPath));
    } else if (entry.name.endsWith('.mdx')) {
      files.push(fullPath);
    }
  }

  return files;
}

// Process all files for a locale
async function processLocale(sourceLocale, destLocale) {
  const sourceDir = join(SOURCE_DIR, sourceLocale);
  const destDir = join(DEST_DIR, destLocale);

  console.log(`\nProcessing ${sourceLocale} -> ${destLocale}`);

  const files = await getMdxFiles(sourceDir);

  for (const file of files) {
    // Calculate relative path from source locale dir
    const relativePath = file.slice(sourceDir.length + 1);
    const destPath = join(destDir, relativePath);

    // Track for navigation
    const navPath = relativePath.replace(/\.mdx$/, '');
    if (!navigationPaths.includes(navPath)) {
      navigationPaths.push(navPath);
    }

    await processFile(file, destPath);
  }
}

// Process changelog
async function processChangelog() {
  const changelogDir = join(SOURCE_DIR, 'changelog');

  if (!existsSync(changelogDir)) {
    console.log('No changelog directory found');
    return;
  }

  console.log('\nProcessing changelog...');

  const files = await getMdxFiles(changelogDir);

  for (const file of files) {
    const filename = basename(file);

    // Process for both locales
    for (const destLocale of Object.values(LOCALE_MAP)) {
      const destPath = join(DEST_DIR, destLocale, 'changelog', filename);
      await processFile(file, destPath);
    }

    // Track for navigation
    const navPath = `changelog/${basename(file, '.mdx')}`;
    if (!navigationPaths.includes(navPath)) {
      navigationPaths.push(navPath);
    }
  }
}

// Process unused/deprecated docs
async function processUnusedDocs() {
  const unusedDir = join(SOURCE_DIR, 'unused_docs');

  if (!existsSync(unusedDir)) {
    console.log('No unused_docs directory found');
    return;
  }

  console.log('\nProcessing unused_docs -> archive...');

  for (const [sourceLocale, destLocale] of Object.entries(LOCALE_MAP)) {
    const sourceLocaleDir = join(unusedDir, sourceLocale);

    if (!existsSync(sourceLocaleDir)) {
      console.log(`No ${sourceLocale} directory in unused_docs`);
      continue;
    }

    const files = await getMdxFiles(sourceLocaleDir);

    for (const file of files) {
      const relativePath = file.slice(sourceLocaleDir.length + 1);
      const destPath = join(DEST_DIR, destLocale, 'archive', relativePath);
      await processFile(file, destPath);
    }
  }
}

// Main function
async function main() {
  console.log('Starting migration...\n');

  // Clear destination directories (except backup)
  for (const destLocale of Object.values(LOCALE_MAP)) {
    const destDir = join(DEST_DIR, destLocale);
    console.log(`Clearing ${destDir}...`);
    // Don't actually delete, just process
  }

  // Process main docs
  for (const [sourceLocale, destLocale] of Object.entries(LOCALE_MAP)) {
    await processLocale(sourceLocale, destLocale);
  }

  // Process changelog
  await processChangelog();

  // Process unused docs
  await processUnusedDocs();

  // Output navigation paths for updating navigation.ts
  console.log('\n\n=== Navigation Paths ===');
  console.log('Add these to navigation.ts order array:\n');
  const sortedPaths = navigationPaths.sort();
  for (const path of sortedPaths) {
    console.log(`    "${path}",`);
  }

  console.log('\n\nMigration complete!');
}

main().catch(console.error);
