# Backend Migration Guide for Privacy Settings

## Overview
This guide helps you migrate the privacy settings from localStorage to the database backend.

## Step 1: Update User Schema

Add the following fields to the `User` interface in `lib/mongodb.ts`:

```typescript
export interface User {
  _id?: ObjectId
  id?: number
  college_id: string
  username?: string
  username_changed_at?: Date
  email?: string
  password_hash: string
  name: string
  department: string
  year: number
  bio?: string
  profile_image?: string
  is_private: boolean
  followers_count: number
  following_count: number
  created_at: Date
  
  // NEW PRIVACY SETTINGS
  show_online_status?: boolean      // Default: true
  show_read_receipts?: boolean      // Default: true
  who_can_message?: 'everyone' | 'followers'  // Default: 'everyone'
  who_can_comment?: 'everyone' | 'followers'  // Default: 'everyone'
}
```

## Step 2: Update User API Endpoint

Modify `pages/api/users/me.ts` to handle the new privacy fields:

### In the GET handler:
```typescript
const user = {
  ...serializeDoc(rawUser),
  posts: transformedPosts,
  follower_count: followerCount,
  following_count: followingCount,
  post_count: postCount,
  is_following: false,
  can_view: true,
  // Include privacy settings with defaults
  show_online_status: rawUser.show_online_status ?? true,
  show_read_receipts: rawUser.show_read_receipts ?? true,
  who_can_message: rawUser.who_can_message ?? 'everyone',
  who_can_comment: rawUser.who_can_comment ?? 'everyone',
}
```

### In the PUT handler:
```typescript
if (req.method === 'PUT') {
  const { 
    name, 
    bio, 
    profile_image, 
    username, 
    is_private,
    show_online_status,
    show_read_receipts,
    who_can_message,
    who_can_comment
  } = req.body as any

  // ... existing validation code ...

  // Build update object
  const updateData: any = {}
  if (typeof name === 'string' && name.trim()) updateData.name = name.trim()
  if (typeof bio === 'string') updateData.bio = bio
  if (typeof profile_image === 'string') updateData.profile_image = profile_image
  if (typeof is_private === 'boolean') updateData.is_private = is_private
  
  // NEW: Add privacy settings
  if (typeof show_online_status === 'boolean') updateData.show_online_status = show_online_status
  if (typeof show_read_receipts === 'boolean') updateData.show_read_receipts = show_read_receipts
  if (who_can_message === 'everyone' || who_can_message === 'followers') {
    updateData.who_can_message = who_can_message
  }
  if (who_can_comment === 'everyone' || who_can_comment === 'followers') {
    updateData.who_can_comment = who_can_comment
  }

  // ... rest of the PUT handler ...
}
```

## Step 3: Update Settings Page

Replace the localStorage implementation in `app/settings/page.tsx`:

### Change the load effect:
```typescript
useEffect(() => {
  const load = async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/users/me', { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      if (resp.ok) {
        const data = await resp.json();
        setIsPrivate(!!data.user?.is_private);
        
        // Load from backend instead of localStorage
        setShowOnlineStatus(data.user?.show_online_status ?? true);
        setShowReadReceipts(data.user?.show_read_receipts ?? true);
        setWhoCanMessage(data.user?.who_can_message ?? 'everyone');
        setWhoCanComment(data.user?.who_can_comment ?? 'everyone');
      } else {
        setError('Failed to load settings');
      }
    } catch {
      setError('Network error loading settings');
    } finally {
      setLoading(false);
    }
  };
  load();
}, [token]);
```

### Update savePrivacySettings function:
```typescript
const savePrivacySettings = async () => {
  if (!token) return;
  try {
    const resp = await fetch('/api/users/me', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({
        show_online_status: showOnlineStatus,
        show_read_receipts: showReadReceipts,
        who_can_message: whoCanMessage,
        who_can_comment: whoCanComment
      })
    });
    
    if (!resp.ok) {
      console.error('Failed to save privacy settings');
    }
  } catch (err) {
    console.error('Error saving privacy settings:', err);
  }
};
```

### Update the onSave function:
```typescript
const onSave = async () => {
  if (!token) return;
  setSaving(true);
  setError(null);
  setMessage(null);
  try {
    const resp = await fetch('/api/users/me', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ 
        is_private: isPrivate,
        show_online_status: showOnlineStatus,
        show_read_receipts: showReadReceipts,
        who_can_message: whoCanMessage,
        who_can_comment: whoCanComment
      })
    });
    if (resp.ok) {
      setMessage('Settings saved');
      setTimeout(() => setMessage(null), 3000);
    } else {
      const err = await resp.json().catch(() => ({} as any));
      setError(err.error || 'Failed to save settings');
    }
  } catch {
    setError('Network error while saving');
  } finally {
    setSaving(false);
  }
};
```

### Remove localStorage calls:
Remove these lines from the settings page:
```typescript
// Remove this:
savePrivacySettings();

// And this from the component:
localStorage.setItem('privacySettings', JSON.stringify(settings));
localStorage.getItem('privacySettings');
```

## Step 4: Implement Privacy Enforcement

### Comments API (`pages/api/comments.ts`):
```typescript
// Check if user can comment
const postOwner = await users.findOne({ id: post.user_id });

if (postOwner?.who_can_comment === 'followers') {
  // Check if commenter is following the post owner
  const isFollowing = await followers.findOne({
    follower_id: auth.userId,
    following_id: post.user_id
  });
  
  if (!isFollowing && auth.userId !== post.user_id) {
    return res.status(403).json({ 
      error: 'Only followers can comment on this post' 
    });
  }
}
```

### Messages API (`pages/api/messages/send.ts`):
```typescript
// Check if user can message
const recipient = await users.findOne({ id: receiverId });

if (recipient?.who_can_message === 'followers') {
  // Check if sender is following the recipient
  const isFollowing = await followers.findOne({
    follower_id: auth.userId,
    following_id: receiverId
  });
  
  if (!isFollowing) {
    return res.status(403).json({ 
      error: 'Only followers can message this user' 
    });
  }
}
```

## Step 5: Implement Additional Features

### Account Deactivation
Create `pages/api/users/deactivate.ts`:
```typescript
import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, Collections, User } from '../../../lib/mongodb'
import { getUserFromRequest } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const auth = getUserFromRequest(req)
  if (!auth) return res.status(401).json({ error: 'Unauthorized' })

  const users = await getCollection<User>(Collections.USERS)
  
  await users.updateOne(
    { id: auth.userId },
    { $set: { is_active: false, deactivated_at: new Date() } }
  )

  return res.status(200).json({ message: 'Account deactivated' })
}
```

### Account Deletion
Create `pages/api/users/delete.ts`:
```typescript
import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, Collections } from '../../../lib/mongodb'
import { getUserFromRequest } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const auth = getUserFromRequest(req)
  if (!auth) return res.status(401).json({ error: 'Unauthorized' })

  // Delete user data
  const [users, posts, comments, followers, messages] = await Promise.all([
    getCollection(Collections.USERS),
    getCollection(Collections.POSTS),
    getCollection(Collections.COMMENTS),
    getCollection(Collections.FOLLOWERS),
    getCollection(Collections.MESSAGES)
  ])

  await Promise.all([
    users.deleteOne({ id: auth.userId }),
    posts.deleteMany({ user_id: auth.userId }),
    comments.deleteMany({ user_id: auth.userId }),
    followers.deleteMany({ $or: [
      { follower_id: auth.userId },
      { following_id: auth.userId }
    ]}),
    messages.deleteMany({ $or: [
      { sender_id: auth.userId },
      { receiver_id: auth.userId }
    ]})
  ])

  return res.status(200).json({ message: 'Account deleted' })
}
```

### Data Export
Create `pages/api/users/export-data.ts`:
```typescript
import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, Collections } from '../../../lib/mongodb'
import { getUserFromRequest } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const auth = getUserFromRequest(req)
  if (!auth) return res.status(401).json({ error: 'Unauthorized' })

  // Gather all user data
  const [users, posts, comments, followers, messages] = await Promise.all([
    getCollection(Collections.USERS),
    getCollection(Collections.POSTS),
    getCollection(Collections.COMMENTS),
    getCollection(Collections.FOLLOWERS),
    getCollection(Collections.MESSAGES)
  ])

  const [userData, userPosts, userComments, userFollowers, userMessages] = await Promise.all([
    users.findOne({ id: auth.userId }),
    posts.find({ user_id: auth.userId }).toArray(),
    comments.find({ user_id: auth.userId }).toArray(),
    followers.find({ 
      $or: [
        { follower_id: auth.userId },
        { following_id: auth.userId }
      ]
    }).toArray(),
    messages.find({ 
      $or: [
        { sender_id: auth.userId },
        { receiver_id: auth.userId }
      ]
    }).toArray()
  ])

  const exportData = {
    user: userData,
    posts: userPosts,
    comments: userComments,
    followers: userFollowers,
    messages: userMessages,
    exported_at: new Date().toISOString()
  }

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', `attachment; filename="uni-x-data-${auth.userId}.json"`)
  res.status(200).json(exportData)
}
```

## Step 6: Add to User Schema (MongoDB)

You may need to add default values for existing users:

```javascript
// Run this migration script once
db.users.updateMany(
  {
    show_online_status: { $exists: false }
  },
  {
    $set: {
      show_online_status: true,
      show_read_receipts: true,
      who_can_message: 'everyone',
      who_can_comment: 'everyone'
    }
  }
)
```

## Testing Checklist

- [ ] Privacy settings save to database correctly
- [ ] Privacy settings load from database on page load
- [ ] Comment restrictions work correctly
- [ ] Message restrictions work correctly
- [ ] Account deactivation works
- [ ] Account deletion works and removes all data
- [ ] Data export includes all user data
- [ ] Default values are set for existing users
- [ ] Online status respects privacy setting
- [ ] Read receipts respect privacy setting

## Rollback Plan

If issues occur, you can rollback by:
1. Reverting the API changes
2. Reverting the settings page to use localStorage
3. Removing the new fields from User schema

The current implementation using localStorage will continue to work until the backend migration is complete.
