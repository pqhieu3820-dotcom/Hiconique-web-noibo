/**
 * Task Manager Data Layer
 * Supports localStorage and Google Sheets integration
 */

const TaskManager = (function() {
  'use strict';

  // Default members
  const DEFAULT_MEMBERS = [
    { id: 'HQ', name: 'Trần Minh Quân', role: 'CEO', color: '#B08D57', avatar: 'HQ' },
    { id: 'HN', name: 'Nguyễn Hiếu', role: 'Trưởng phòng Thiết kế', color: '#8E7CC3', avatar: 'HN' },
    { id: 'PH', name: 'Phạm Hoàng', role: 'Giám sát thi công', color: '#C7A464', avatar: 'PH' },
    { id: 'TM', name: 'Trần Mạnh', role: 'Truyền thông', color: '#4F6F52', avatar: 'TM' },
    { id: 'GP', name: 'Giản Phương', role: 'Thiết kế đồ họa', color: '#3B6B8C', avatar: 'GP' },
    { id: 'LT', name: 'Lê Thành', role: 'Kỹ sư nội thất', color: '#B8725A', avatar: 'LT' },
    { id: 'NT', name: 'Ngọc Trang', role: 'Nhân sự', color: '#6B5B95', avatar: 'NT' },
    { id: 'VH', name: 'Vũ Hùng', role: 'Kế toán', color: '#88B04B', avatar: 'VH' },
    { id: 'DN', name: 'Đỗ Nam', role: 'Thiết kế nội thất', color: '#F7CAC9', avatar: 'DN' },
    { id: 'QM', name: 'Quách Minh', role: 'Thi công', color: '#92A8D1', avatar: 'QM' }
  ];

  // Default projects
  const DEFAULT_PROJECTS = [
    { id: 'prj_001', name: 'Vinhouse Mỹ Đình', type: 'Thiết kế nội thất', progress: 65, status: 'on-track', members: ['HQ', 'HN', 'PH'], color: '#B08D57', createdAt: '2026-07-15' },
    { id: 'prj_002', name: 'Penthouse HP', type: 'Triển khai bản vẽ', progress: 40, status: 'on-track', members: ['HN', 'PH'], color: '#3B6B8C', createdAt: '2026-07-20' },
    { id: 'prj_003', name: 'Biệt thự Đà Lạt', type: 'Thi công nội thất', progress: 91, status: 'on-track', members: ['PH', 'TM'], color: '#B8725A', createdAt: '2026-06-01' },
    { id: 'prj_004', name: 'Showroom HCM', type: 'Concept 3D', progress: 24, status: 'on-track', members: ['GP'], color: '#4F6F52', createdAt: '2026-08-01' },
    { id: 'prj_005', name: 'Risk Project', type: 'Thiết kế web', progress: 30, status: 'at-risk', members: ['TM'], color: '#A04848', createdAt: '2026-07-10' },
    { id: 'prj_006', name: '20 Landing page', type: 'Web design', progress: 85, status: 'on-track', members: ['TM', 'GP'], color: '#C7A464', createdAt: '2026-06-15' }
  ];

  // Default tasks
  const DEFAULT_TASKS = [
    { id: 'task_001', title: 'Review design mockups cho Vinhouse', description: 'Kiểm tra và phản hồi bản mockup mới nhất', projectId: 'prj_001', assigneeId: 'HN', priority: 'high', status: 'pending', deadline: '2026-08-12T11:00', createdBy: 'HQ', createdAt: '2026-08-10' },
    { id: 'task_002', title: 'Chuẩn bị presentation khách hàng', description: 'Slide trình bày cho buổi họp với khách hàng', projectId: 'prj_001', assigneeId: 'TM', priority: 'high', status: 'in-progress', deadline: '2026-08-12T14:00', createdBy: 'HN', createdAt: '2026-08-09' },
    { id: 'task_003', title: 'Code review - Authentication module', description: 'Kiểm tra code module đăng nhập', projectId: 'prj_005', assigneeId: 'GP', priority: 'medium', status: 'pending', deadline: '2026-08-12T15:00', createdBy: 'HQ', createdAt: '2026-08-08' },
    { id: 'task_004', title: 'Quản lý social media', description: 'Đăng bài lên fanpage và Instagram', projectId: 'prj_006', assigneeId: 'TM', priority: 'low', status: 'in-progress', deadline: '2026-08-12T16:30', createdBy: 'HN', createdAt: '2026-08-07' },
    { id: 'task_005', title: 'Visual design review', description: 'Review thiết kế visual cho website', projectId: 'prj_005', assigneeId: 'GP', priority: 'low', status: 'pending', deadline: '2026-08-12T17:00', createdBy: 'TM', createdAt: '2026-08-06' },
    { id: 'task_006', title: 'Gửi báo giá vật liệu', description: 'Liên hệ nhà cung cấp và gửi báo giá', projectId: 'prj_003', assigneeId: 'PH', priority: 'high', status: 'completed', deadline: '2026-08-11T10:00', createdBy: 'HQ', createdAt: '2026-08-05' },
    { id: 'task_007', title: 'Họp kick-off dự án mới', description: 'Buổi họp kick-off với team', projectId: 'prj_004', assigneeId: 'HN', priority: 'high', status: 'completed', deadline: '2026-08-10T09:00', createdBy: 'HQ', createdAt: '2026-08-01' },
    { id: 'task_008', title: 'Triển khai bản vẽ kỹ thuật', description: 'Hoàn thiện bản vẽ kỹ thuật cho Penthouse', projectId: 'prj_002', assigneeId: 'LT', priority: 'medium', status: 'in-progress', deadline: '2026-08-15T17:00', createdBy: 'PH', createdAt: '2026-08-08' }
  ];

  // Default proposals
  const DEFAULT_PROPOSALS = [
    { id: 'prop_001', title: 'Mua thêm máy tính cho team design', description: 'Cần thêm 2 máy tính cấu hình mạnh cho công việc 3D', type: 'mua-sam', status: 'pending', requesterId: 'HN', reviewerId: 'HQ', amount: 50000000, createdAt: '2026-08-10' },
    { id: 'prop_002', title: 'Đăng ký khóa học SketchUp nâng cao', description: 'Khóa học online cho 3 thành viên', type: 'dao-tao', status: 'approved', requesterId: 'GP', reviewerId: 'HN', amount: 15000000, createdAt: '2026-08-05' },
    { id: 'prop_003', title: 'Sửa chữa máy chiếu phòng họp', description: 'Máy chiếu bị hỏng cần mang đi sửa', type: 'sua-chua', status: 'rejected', requesterId: 'NT', reviewerId: 'HQ', amount: 3000000, createdAt: '2026-08-01' }
  ];

  // Storage keys
  const STORAGE_KEYS = {
    projects: 'hiconique_projects',
    tasks: 'hiconique_tasks',
    members: 'hiconique_members',
    proposals: 'hiconique_proposals',
    settings: 'hiconique_settings'
  };

  // Get current user (simulated - in real app would come from auth)
  function getCurrentUser() {
    return DEFAULT_MEMBERS[0]; // HQ as default
  }

  // Initialize data from localStorage or defaults
  function initData() {
    if (!localStorage.getItem(STORAGE_KEYS.projects)) {
      localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(DEFAULT_PROJECTS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.tasks)) {
      localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(DEFAULT_TASKS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.members)) {
      localStorage.setItem(STORAGE_KEYS.members, JSON.stringify(DEFAULT_MEMBERS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.proposals)) {
      localStorage.setItem(STORAGE_KEYS.proposals, JSON.stringify(DEFAULT_PROPOSALS));
    }
  }

  // Generic CRUD operations
  function getAll(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  function getById(key, id) {
    const items = getAll(key);
    return items.find(item => item.id === id);
  }

  function save(key, items) {
    localStorage.setItem(key, JSON.stringify(items));
  }

  function add(key, item) {
    const items = getAll(key);
    item.id = key.replace('hiconique_', '') + '_' + Date.now();
    item.createdAt = new Date().toISOString().split('T')[0];
    items.push(item);
    save(key, items);
    return item;
  }

  function update(key, id, updates) {
    const items = getAll(key);
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...updates, updatedAt: new Date().toISOString() };
      save(key, items);
      return items[index];
    }
    return null;
  }

  function remove(key, id) {
    const items = getAll(key);
    const filtered = items.filter(item => item.id !== id);
    save(key, filtered);
    return filtered;
  }

  // Projects
  function getProjects() {
    return getAll(STORAGE_KEYS.projects);
  }

  function getProject(id) {
    return getById(STORAGE_KEYS.projects, id);
  }

  function createProject(project) {
    project.status = project.status || 'on-track';
    project.progress = project.progress || 0;
    return add(STORAGE_KEYS.projects, project);
  }

  function updateProject(id, updates) {
    return update(STORAGE_KEYS.projects, id, updates);
  }

  function deleteProject(id) {
    // Also delete all tasks in this project
    const tasks = getAll(STORAGE_KEYS.tasks).filter(t => t.projectId !== id);
    localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
    return remove(STORAGE_KEYS.projects, id);
  }

  // Tasks
  function getTasks(filters = {}) {
    let tasks = getAll(STORAGE_KEYS.tasks);

    if (filters.status) {
      tasks = tasks.filter(t => t.status === filters.status);
    }
    if (filters.priority) {
      tasks = tasks.filter(t => t.priority === filters.priority);
    }
    if (filters.assigneeId) {
      tasks = tasks.filter(t => t.assigneeId === filters.assigneeId);
    }
    if (filters.projectId) {
      tasks = tasks.filter(t => t.projectId === filters.projectId);
    }
    if (filters.search) {
      const search = filters.search.toLowerCase();
      tasks = tasks.filter(t =>
        t.title.toLowerCase().includes(search) ||
        (t.description && t.description.toLowerCase().includes(search))
      );
    }

    return tasks.sort((a, b) => {
      // Sort by deadline
      if (a.deadline && b.deadline) {
        return new Date(a.deadline) - new Date(b.deadline);
      }
      return 0;
    });
  }

  function getTask(id) {
    return getById(STORAGE_KEYS.tasks, id);
  }

  function createTask(task) {
    task.status = task.status || 'pending';
    return add(STORAGE_KEYS.tasks, task);
  }

  function updateTask(id, updates) {
    return update(STORAGE_KEYS.tasks, id, updates);
  }

  function deleteTask(id) {
    return remove(STORAGE_KEYS.tasks, id);
  }

  function toggleTaskStatus(id) {
    const task = getTask(id);
    if (task) {
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      return updateTask(id, { status: newStatus });
    }
    return null;
  }

  // Members
  function getMembers() {
    return getAll(STORAGE_KEYS.members);
  }

  function getMember(id) {
    return getById(STORAGE_KEYS.members, id);
  }

  // Proposals
  function getProposals(filters = {}) {
    let proposals = getAll(STORAGE_KEYS.proposals);

    if (filters.status) {
      proposals = proposals.filter(p => p.status === filters.status);
    }
    if (filters.requesterId) {
      proposals = proposals.filter(p => p.requesterId === filters.requesterId);
    }

    return proposals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function getProposal(id) {
    return getById(STORAGE_KEYS.proposals, id);
  }

  function createProposal(proposal) {
    proposal.status = proposal.status || 'pending';
    return add(STORAGE_KEYS.proposals, proposal);
  }

  function updateProposal(id, updates) {
    return update(STORAGE_KEYS.proposals, id, updates);
  }

  function approveProposal(id) {
    return updateProposal(id, { status: 'approved', reviewedAt: new Date().toISOString() });
  }

  function rejectProposal(id) {
    return updateProposal(id, { status: 'rejected', reviewedAt: new Date().toISOString() });
  }

  // Statistics
  function getStats() {
    const tasks = getAll(STORAGE_KEYS.tasks);
    const projects = getAll(STORAGE_KEYS.projects);
    const members = getAll(STORAGE_KEYS.members);

    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const pendingTasks = tasks.filter(t => t.status === 'pending').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;

    const today = new Date().toISOString().split('T')[0];
    const dueToday = tasks.filter(t => {
      if (!t.deadline) return false;
      return t.deadline.startsWith(today) && t.status !== 'completed';
    }).length;

    const onlineMembers = 3; // Simulated

    return {
      totalProjects: projects.length,
      activeProjects: projects.filter(p => p.status !== 'completed').length,
      completedTasks,
      pendingTasks,
      inProgressTasks,
      totalTasks: tasks.length,
      dueToday,
      totalMembers: members.length,
      onlineMembers
    };
  }

  // Initialize on load
  initData();

  // Public API
  return {
    // User
    getCurrentUser,

    // Projects
    getProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,

    // Tasks
    getTasks,
    getTask,
    createTask,
    updateTask,
    deleteTask,
    toggleTaskStatus,

    // Members
    getMembers,
    getMember,

    // Proposals
    getProposals,
    getProposal,
    createProposal,
    updateProposal,
    approveProposal,
    rejectProposal,

    // Stats
    getStats,

    // Storage
    STORAGE_KEYS
  };
})();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TaskManager;
}
