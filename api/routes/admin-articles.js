const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * Helper function to call Python database operations
 */
function callPythonDB(method, args = {}) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, '..', '..', 'scripts', 'articles_db_bridge.py');
    const python = spawn('python', [pythonScript, method, JSON.stringify(args)]);

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        console.error('Python stderr:', stderr);
        reject(new Error(`Python script failed with code ${code}: ${stderr}`));
      } else {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (err) {
          reject(new Error(`Failed to parse Python output: ${stdout}`));
        }
      }
    });
  });
}

/**
 * GET /api/admin/articles
 * List all articles with pagination and filters
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 25, status, author_id, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const result = await callPythonDB('list_articles', {
      status,
      author_id,
      limit: parseInt(limit),
      offset,
    });

    // Get total count for pagination
    const countResult = await callPythonDB('count_articles', { status });

    const articles = result.articles || [];
    const total = countResult.count || 0;

    // Filter by search if provided
    let filteredArticles = articles;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredArticles = articles.filter(article =>
        article.title.toLowerCase().includes(searchLower) ||
        (article.excerpt && article.excerpt.toLowerCase().includes(searchLower))
      );
    }

    res.json({
      articles: filteredArticles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

/**
 * GET /api/admin/articles/:id
 * Get a single article by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const result = await callPythonDB('get_article', { article_id: req.params.id });

    if (!result.article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json(result.article);
  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

/**
 * POST /api/admin/articles
 * Create a new article (requires editor role or higher)
 */
router.post('/', requireRole(['editor', 'admin', 'super_admin']), async (req, res) => {
  try {
    const {
      title,
      slug,
      content,
      excerpt,
      featured_image,
      status = 'draft',
      category,
      tags,
      seo_title,
      seo_description,
      seo_keywords,
      published_at,
      scheduled_for,
    } = req.body;

    // Validation
    if (!title || !slug || !content) {
      return res.status(400).json({ error: 'Title, slug, and content are required' });
    }

    // Create slug from title if not provided
    const finalSlug = slug || title.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');

    const result = await callPythonDB('create_article', {
      title,
      slug: finalSlug,
      content,
      author_id: req.user.userId,
      excerpt,
      featured_image,
      status,
      category,
      tags: Array.isArray(tags) ? tags : [],
      seo_title,
      seo_description,
      seo_keywords,
      published_at,
      scheduled_for,
    });

    res.status(201).json({ id: result.article_id, message: 'Article created successfully' });
  } catch (error) {
    console.error('Error creating article:', error);
    if (error.message.includes('UNIQUE constraint')) {
      res.status(409).json({ error: 'An article with this slug already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create article' });
    }
  }
});

/**
 * PUT /api/admin/articles/:id
 * Update an article (requires editor role or higher)
 */
router.put('/:id', requireRole(['editor', 'admin', 'super_admin']), async (req, res) => {
  try {
    const {
      title,
      slug,
      content,
      excerpt,
      featured_image,
      status,
      category,
      tags,
      seo_title,
      seo_description,
      seo_keywords,
      published_at,
      scheduled_for,
    } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (slug !== undefined) updateData.slug = slug;
    if (content !== undefined) updateData.content = content;
    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (featured_image !== undefined) updateData.featured_image = featured_image;
    if (status !== undefined) updateData.status = status;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = tags;
    if (seo_title !== undefined) updateData.seo_title = seo_title;
    if (seo_description !== undefined) updateData.seo_description = seo_description;
    if (seo_keywords !== undefined) updateData.seo_keywords = seo_keywords;
    if (published_at !== undefined) updateData.published_at = published_at;
    if (scheduled_for !== undefined) updateData.scheduled_for = scheduled_for;

    // If publishing, set published_at
    if (status === 'published' && !published_at) {
      updateData.published_at = new Date().toISOString();
    }

    const result = await callPythonDB('update_article', {
      article_id: req.params.id,
      ...updateData,
    });

    if (!result.success) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({ message: 'Article updated successfully' });
  } catch (error) {
    console.error('Error updating article:', error);
    if (error.message.includes('UNIQUE constraint')) {
      res.status(409).json({ error: 'An article with this slug already exists' });
    } else {
      res.status(500).json({ error: 'Failed to update article' });
    }
  }
});

/**
 * DELETE /api/admin/articles/:id
 * Delete an article (requires admin role or higher)
 */
router.delete('/:id', requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const result = await callPythonDB('delete_article', { article_id: req.params.id });

    if (!result.success) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({ message: 'Article deleted successfully' });
  } catch (error) {
    console.error('Error deleting article:', error);
    res.status(500).json({ error: 'Failed to delete article' });
  }
});

/**
 * POST /api/admin/articles/:id/publish
 * Publish an article (requires editor role or higher)
 */
router.post('/:id/publish', requireRole(['editor', 'admin', 'super_admin']), async (req, res) => {
  try {
    const result = await callPythonDB('update_article', {
      article_id: req.params.id,
      status: 'published',
      published_at: new Date().toISOString(),
    });

    if (!result.success) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({ message: 'Article published successfully' });
  } catch (error) {
    console.error('Error publishing article:', error);
    res.status(500).json({ error: 'Failed to publish article' });
  }
});

/**
 * POST /api/admin/articles/:id/unpublish
 * Unpublish an article (requires editor role or higher)
 */
router.post('/:id/unpublish', requireRole(['editor', 'admin', 'super_admin']), async (req, res) => {
  try {
    const result = await callPythonDB('update_article', {
      article_id: req.params.id,
      status: 'draft',
      published_at: null,
    });

    if (!result.success) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({ message: 'Article unpublished successfully' });
  } catch (error) {
    console.error('Error unpublishing article:', error);
    res.status(500).json({ error: 'Failed to unpublish article' });
  }
});

module.exports = router;
