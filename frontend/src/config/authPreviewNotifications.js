import { BookOpen, MessageCircle, Mail } from 'lucide-react';

const authPreviewNotifications = [
  {
    icon: MessageCircle,
    iconClass: 'auth-notif-icon-wa',
    source: 'NLP Group',
    message: 'Assignment 3 due Friday at 11:59 PM',
    time: '2m ago',
    tag: 'Deadline',
    tagClass: 'auth-notif-tag-urgent',
    delay: 0,
  },
  {
    icon: BookOpen,
    iconClass: 'auth-notif-icon-cls',
    source: 'Operating Systems',
    message: 'Mid-term marks have been posted',
    time: '14m ago',
    tag: 'Grades',
    tagClass: 'auth-notif-tag-info',
    delay: 1,
  },
  {
    icon: Mail,
    iconClass: 'auth-notif-icon-gm',
    source: 'university@fast.edu',
    message: 'Fee submission deadline: Dec 15',
    time: '1h ago',
    tag: 'Finance',
    tagClass: 'auth-notif-tag-warn',
    delay: 2,
  },
];

export default authPreviewNotifications;
