import express from 'express';
import cors from 'cors';
import { initialIssues } from './data/sampleIssues.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '25mb' }));

// In-memory data store initialized with pre-populated dummy issues
let issuesStore = [...initialIssues];

// Helper: Calculate mock SLA deadline based on priority
function calculateSLA(priority) {
  const now = Date.now();
  switch (priority) {
    case 'Urgent': return new Date(now + 12 * 3600 * 1000).toISOString();
    case 'High': return new Date(now + 24 * 3600 * 1000).toISOString();
    case 'Medium': return new Date(now + 48 * 3600 * 1000).toISOString();
    case 'Low': default: return new Date(now + 72 * 3600 * 1000).toISOString();
  }
}

// Helper: Mock AI classification
function mockAICategorize(title, description, category) {
  const sampleConfidence = (Math.random() * (0.98 - 0.88) + 0.88).toFixed(2);
  return {
    category: category || "Roads & Infrastructure",
    confidence: parseFloat(sampleConfidence),
    detectedObject: `Detected ${category || 'Civic Issue'} Pattern`
  };
}

// REST Routes

// GET /api/issues - Fetch list with filtering & search
app.get('/api/issues', (req, res) => {
  const { category, status, priority, search } = req.query;
  let filtered = [...issuesStore];

  if (category && category !== 'All') {
    filtered = filtered.filter(i => i.category === category);
  }
  if (status && status !== 'All') {
    filtered = filtered.filter(i => i.status === status);
  }
  if (priority && priority !== 'All') {
    filtered = filtered.filter(i => i.priority === priority);
  }
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(i => 
      i.title.toLowerCase().includes(q) || 
      i.description.toLowerCase().includes(q) ||
      i.id.toLowerCase().includes(q) ||
      (i.location?.address && i.location.address.toLowerCase().includes(q))
    );
  }

  // Sort newest first
  filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({ success: true, count: filtered.length, data: filtered });
});

// GET /api/issues/:id - Fetch single issue
app.get('/api/issues/:id', (req, res) => {
  const issue = issuesStore.find(i => i.id === req.params.id);
  if (!issue) {
    return res.status(404).json({ success: false, message: 'Issue not found' });
  }
  res.json({ success: true, data: issue });
});

// POST /api/issues - Submit new issue
app.post('/api/issues', (req, res) => {
  const { title, description, category, priority, location, image, reporterName } = req.body;

  if (!title || !description || !category) {
    return res.status(400).json({ success: false, message: 'Title, description and category are required' });
  }

  const issueId = `CITY-${100 + issuesStore.length + 1}`;
  const nowStr = new Date().toISOString();
  const selectedPriority = priority || 'Medium';

  const defaultDepartments = {
    'Roads & Infrastructure': 'Department of Public Works',
    'Sanitation & Garbage': 'Sanitation & Waste Management',
    'Streetlights & Electrical': 'Electrical Grid & Utilities',
    'Water & Drainage': 'Municipal Water Authority',
    'Parks & Trees': 'Urban Forestry & Parks',
    'Public Safety': 'Civic Safety & Rapid Response'
  };

  const newIssue = {
    id: issueId,
    title,
    description,
    category,
    priority: selectedPriority,
    status: 'Reported',
    assignedDepartment: defaultDepartments[category] || 'General Municipal Operations',
    location: location || { address: 'Metropolitan District', lat: 37.7749, lng: -122.4194 },
    image: image || 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80',
    beforeAfterImage: {
      before: image || 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80',
      after: null
    },
    reporter: {
      name: reporterName || 'Anonymous Resident',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
      role: 'Citizen'
    },
    upvotes: 1,
    upvotedBy: ['current-user'],
    aiDetection: mockAICategorize(title, description, category),
    slaDueDate: calculateSLA(selectedPriority),
    createdAt: nowStr,
    updatedAt: nowStr,
    timeline: [
      {
        status: 'Reported',
        title: 'Issue Submitted & Categorized',
        note: `Logged via CityConnect portal. Auto-assigned routing to ${defaultDepartments[category] || 'Municipal Dispatch'}.`,
        timestamp: nowStr,
        actor: reporterName || 'Resident'
      }
    ]
  };

  issuesStore.unshift(newIssue);
  res.status(201).json({ success: true, data: newIssue, message: 'Issue reported successfully!' });
});

// PATCH /api/issues/:id/status - Admin status/department update
app.patch('/api/issues/:id/status', (req, res) => {
  const { status, assignedDepartment, priority, note, afterImage, updatedBy } = req.body;
  const issueIndex = issuesStore.findIndex(i => i.id === req.params.id);

  if (issueIndex === -1) {
    return res.status(404).json({ success: false, message: 'Issue not found' });
  }

  const issue = issuesStore[issueIndex];
  const nowStr = new Date().toISOString();

  if (status) issue.status = status;
  if (assignedDepartment) issue.assignedDepartment = assignedDepartment;
  if (priority) issue.priority = priority;
  if (afterImage) {
    issue.beforeAfterImage = {
      before: issue.image,
      after: afterImage
    };
  }
  issue.updatedAt = nowStr;

  // Append to timeline
  const timelineTitles = {
    'Reported': 'Status Reset to Reported',
    'Assigned': `Assigned to ${assignedDepartment || issue.assignedDepartment}`,
    'In Progress': 'Work Order Issued - Crews On Site',
    'Fixed': 'Resolution Work Completed',
    'Verified': 'Civic Resolution Verified & Archived'
  };

  issue.timeline.push({
    status: status || issue.status,
    title: timelineTitles[status] || `Updated to ${status}`,
    note: note || `Department status updated by ${updatedBy || 'Authority Dispatcher'}.`,
    timestamp: nowStr,
    actor: updatedBy || 'Department Admin'
  });

  issuesStore[issueIndex] = issue;
  res.json({ success: true, data: issue, message: 'Status updated successfully' });
});

// POST /api/issues/:id/upvote - Upvote issue
app.post('/api/issues/:id/upvote', (req, res) => {
  const issue = issuesStore.find(i => i.id === req.params.id);
  if (!issue) {
    return res.status(404).json({ success: false, message: 'Issue not found' });
  }

  const userId = req.body.userId || 'current-user';
  const hasUpvoted = issue.upvotedBy.includes(userId);

  if (hasUpvoted) {
    issue.upvotes = Math.max(0, issue.upvotes - 1);
    issue.upvotedBy = issue.upvotedBy.filter(id => id !== userId);
  } else {
    issue.upvotes += 1;
    issue.upvotedBy.push(userId);
  }

  res.json({ success: true, upvotes: issue.upvotes, upvoted: !hasUpvoted });
});

// POST /api/issues/:id/verify - Citizen verification
app.post('/api/issues/:id/verify', (req, res) => {
  const { action, feedbackNote } = req.body;
  const issue = issuesStore.find(i => i.id === req.params.id);

  if (!issue) {
    return res.status(404).json({ success: false, message: 'Issue not found' });
  }

  const nowStr = new Date().toISOString();

  if (action === 'verify') {
    issue.status = 'Verified';
    issue.timeline.push({
      status: 'Verified',
      title: 'Resolution Verified by Resident',
      note: feedbackNote || 'Citizen confirmed issue resolution with high satisfaction.',
      timestamp: nowStr,
      actor: issue.reporter.name + ' (Citizen)'
    });
  } else if (action === 'reopen') {
    issue.status = 'In Progress';
    issue.timeline.push({
      status: 'In Progress',
      title: 'Resolution Reopened by Resident',
      note: feedbackNote || 'Citizen indicated fix is incomplete or required further maintenance.',
      timestamp: nowStr,
      actor: issue.reporter.name + ' (Citizen)'
    });
  }

  issue.updatedAt = nowStr;
  res.json({ success: true, data: issue });
});

// GET /api/stats - High level analytics
app.get('/api/stats', (req, res) => {
  const total = issuesStore.length;
  const reported = issuesStore.filter(i => i.status === 'Reported').length;
  const inProgress = issuesStore.filter(i => i.status === 'In Progress' || i.status === 'Assigned').length;
  const resolved = issuesStore.filter(i => i.status === 'Fixed' || i.status === 'Verified').length;
  
  const now = new Date();
  const overdueCount = issuesStore.filter(i => 
    i.status !== 'Fixed' && 
    i.status !== 'Verified' && 
    new Date(i.slaDueDate) < now
  ).length;

  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  res.json({
    success: true,
    stats: {
      total,
      reported,
      inProgress,
      resolved,
      overdueCount,
      resolutionRate,
      avgResolutionHours: 28.4
    }
  });
});

app.listen(PORT, () => {
  console.log(`⚡ CityConnect REST API Server listening on http://localhost:${PORT}`);
});

