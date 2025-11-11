import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, Collections, withRetry } from '../../../lib/mongodb'
import { getUserFromRequest } from '../../../lib/auth'

interface User {
  id: number
  name: string
  username?: string
  college_id: string
  department: string
  year: number
  bio?: string
  profile_image?: string
  is_private: boolean
}

interface Follower {
  id: number
  follower_id: number
  following_id: number
}

interface SuggestionScore {
  userId: number
  mutualFriends: number
  mutualFollowerIds: number[]
  sameDepartment: boolean
  sameYear: boolean
  sameCollege: boolean
  totalScore: number
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const auth = getUserFromRequest(req)
    if (!auth) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { limit = '10', algorithm = 'advanced' } = req.query
    const limitNum = parseInt(limit as string)
    const currentUserId = auth.userId

    console.log('🔍 Generating suggestions for user:', currentUserId)

    const users = await getCollection<User>(Collections.USERS)
    const followers = await getCollection<Follower>(Collections.FOLLOWERS)
    const followRequests = await getCollection(Collections.FOLLOW_REQUESTS)

    // Get current user info
    const currentUser = await users.findOne({ id: currentUserId })
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Get users the current user is already following
    const following = await followers
      .find({ follower_id: currentUserId })
      .toArray()
    const followingIds = following.map(f => f.following_id)

    // Get pending follow requests
    const pendingRequests = await followRequests
      .find({ requester_id: currentUserId })
      .toArray()
    const requestedIds = pendingRequests.map((r: any) => r.target_id)

    // Exclude: self, already following, and pending requests
    const excludeIds = [currentUserId, ...followingIds, ...requestedIds]

    console.log('👥 User is following:', followingIds.length, 'users')
    console.log('🚫 Excluding:', excludeIds.length, 'users')

    if (algorithm === 'simple') {
      // Simple algorithm: just suggest users from same department/year
      return handleSimpleSuggestions(
        res,
        users,
        followers,
        currentUser,
        excludeIds,
        limitNum
      )
    }

    // Advanced algorithm: Friends of friends + similarity scoring
    return handleAdvancedSuggestions(
      res,
      users,
      followers,
      currentUser,
      followingIds,
      excludeIds,
      limitNum
    )
  } catch (error: any) {
    console.error('❌ Error generating suggestions:', error)
    res.status(500).json({ error: 'Failed to generate suggestions' })
  }
}

// Simple suggestion algorithm
async function handleSimpleSuggestions(
  res: NextApiResponse,
  users: any,
  followers: any,
  currentUser: User,
  excludeIds: number[],
  limit: number
) {
  console.log('📊 Using simple suggestion algorithm')

  // Find users from same department or year
  const suggestions = await users
    .find({
      id: { $nin: excludeIds },
      $or: [
        { department: currentUser.department, year: currentUser.year },
        { department: currentUser.department },
        { year: currentUser.year }
      ]
    })
    .limit(limit)
    .toArray()

  // Get follower counts
  const suggestionIds = suggestions.map((s: User) => s.id)
  const followerCounts = await Promise.all(
    suggestionIds.map(async (id: number) => {
      const count = await followers.countDocuments({ following_id: id })
      return { id, count }
    })
  )
  const followerCountMap = new Map(followerCounts.map(fc => [fc.id, fc.count]))

  const transformedSuggestions = suggestions.map((user: User) => ({
    id: user.id,
    name: user.name,
    username: user.username,
    department: user.department,
    year: user.year,
    profile_image: user.profile_image,
    bio: user.bio,
    follower_count: followerCountMap.get(user.id) || 0,
    mutualFriends: 0,
    reason: user.department === currentUser.department && user.year === currentUser.year
      ? 'Same department and year'
      : user.department === currentUser.department
      ? 'Same department'
      : 'Same year'
  }))

  console.log('✅ Returning', transformedSuggestions.length, 'simple suggestions')
  return res.status(200).json({ suggestions: transformedSuggestions })
}

// Advanced suggestion algorithm with friends-of-friends
async function handleAdvancedSuggestions(
  res: NextApiResponse,
  users: any,
  followers: any,
  currentUser: User,
  followingIds: number[],
  excludeIds: number[],
  limit: number
) {
  console.log('🧠 Using advanced suggestion algorithm')

  // Step 1: Get friends of friends (people followed by people you follow)
  const friendsOfFriends = await followers
    .find({ follower_id: { $in: followingIds } })
    .toArray()

  console.log('👥 Found', friendsOfFriends.length, 'friends-of-friends connections')

  // Step 2: Count mutual friends and build suggestion scores
  const suggestionMap = new Map<number, SuggestionScore>()

  for (const fof of friendsOfFriends) {
    const candidateId = fof.following_id

    // Skip if already excluded
    if (excludeIds.includes(candidateId)) continue

    if (!suggestionMap.has(candidateId)) {
      suggestionMap.set(candidateId, {
        userId: candidateId,
        mutualFriends: 0,
        mutualFollowerIds: [],
        sameDepartment: false,
        sameYear: false,
        sameCollege: false,
        totalScore: 0
      })
    }

    const score = suggestionMap.get(candidateId)!
    score.mutualFriends++
    score.mutualFollowerIds.push(fof.follower_id)
  }

  console.log('📊 Found', suggestionMap.size, 'potential suggestions')

  // If we don't have enough suggestions, add users from same department/year
  if (suggestionMap.size < limit) {
    console.log('➕ Adding users from same department/year to fill suggestions')
    
    const sameDeptUsers = await users
      .find({
        id: { $nin: excludeIds },
        $or: [
          { department: currentUser.department, year: currentUser.year },
          { department: currentUser.department },
          { year: currentUser.year }
        ]
      })
      .limit(limit * 2)
      .toArray()

    for (const user of sameDeptUsers) {
      if (!suggestionMap.has(user.id)) {
        suggestionMap.set(user.id, {
          userId: user.id,
          mutualFriends: 0,
          mutualFollowerIds: [],
          sameDepartment: user.department === currentUser.department,
          sameYear: user.year === currentUser.year,
          sameCollege: user.college_id === currentUser.college_id,
          totalScore: 0
        })
      }
    }
  }

  // Step 3: Get user details for all candidates
  const candidateIds = Array.from(suggestionMap.keys())
  const candidateUsers = await users
    .find({ id: { $in: candidateIds } })
    .toArray()

  console.log('👤 Fetched', candidateUsers.length, 'candidate user profiles')

  // Step 4: Calculate scores
  for (const user of candidateUsers) {
    const score = suggestionMap.get(user.id)!
    
    // Update similarity flags
    score.sameDepartment = user.department === currentUser.department
    score.sameYear = user.year === currentUser.year
    score.sameCollege = user.college_id === currentUser.college_id

    // Calculate total score
    let totalScore = 0
    
    // Mutual friends are most important (3 points each)
    totalScore += score.mutualFriends * 3
    
    // Same department and year is very relevant (5 points)
    if (score.sameDepartment && score.sameYear) {
      totalScore += 5
    } else if (score.sameDepartment) {
      totalScore += 3
    } else if (score.sameYear) {
      totalScore += 2
    }
    
    // Same college (1 point)
    if (score.sameCollege) {
      totalScore += 1
    }

    score.totalScore = totalScore
  }

  // Step 5: Sort by score and take top N
  const sortedSuggestions = Array.from(suggestionMap.values())
    .sort((a, b) => {
      // Primary sort: total score
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore
      }
      // Secondary sort: mutual friends
      return b.mutualFriends - a.mutualFriends
    })
    .slice(0, limit)

  // Step 6: Get follower counts and mutual friend names
  const finalUserIds = sortedSuggestions.map(s => s.userId)
  const followerCounts = await Promise.all(
    finalUserIds.map(async (id: number) => {
      const count = await followers.countDocuments({ following_id: id })
      return { id, count }
    })
  )
  const followerCountMap = new Map(followerCounts.map(fc => [fc.id, fc.count]))

  // Get mutual friend details for display
  const mutualFriendIds = new Set<number>()
  sortedSuggestions.forEach(s => {
    s.mutualFollowerIds.forEach(id => mutualFriendIds.add(id))
  })
  const mutualFriendUsers = await users
    .find({ id: { $in: Array.from(mutualFriendIds) } })
    .toArray()
  const mutualFriendMap = new Map(mutualFriendUsers.map((u: User) => [u.id, u]))

  // Step 7: Build final response
  const transformedSuggestions = sortedSuggestions.map(score => {
    const user = candidateUsers.find((u: User) => u.id === score.userId)
    if (!user) return null

    // Get names of mutual friends (up to 3)
    const mutualFriendNames = score.mutualFollowerIds
      .slice(0, 3)
      .map(id => {
        const friend = mutualFriendMap.get(id) as User | undefined
        return friend?.name
      })
      .filter(Boolean) as string[]

    // Generate reason text
    let reason = ''
    if (score.mutualFriends > 0) {
      if (mutualFriendNames.length > 0) {
        const friendsList = mutualFriendNames.join(', ')
        const andMore = score.mutualFriends > mutualFriendNames.length 
          ? ` and ${score.mutualFriends - mutualFriendNames.length} other${score.mutualFriends - mutualFriendNames.length > 1 ? 's' : ''}`
          : ''
        reason = `Followed by ${friendsList}${andMore}`
      } else {
        reason = `${score.mutualFriends} mutual friend${score.mutualFriends > 1 ? 's' : ''}`
      }
    } else if (score.sameDepartment && score.sameYear) {
      reason = `${user.department} • ${user.year}${getYearSuffix(user.year)} Year`
    } else if (score.sameDepartment) {
      reason = `Same department (${user.department})`
    } else if (score.sameYear) {
      reason = `Same year (${user.year}${getYearSuffix(user.year)})`
    } else {
      reason = 'Suggested for you'
    }

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      department: user.department,
      year: user.year,
      profile_image: user.profile_image,
      bio: user.bio,
      follower_count: followerCountMap.get(user.id) || 0,
      mutualFriends: score.mutualFriends,
      mutualFriendNames,
      reason,
      score: score.totalScore
    }
  }).filter(Boolean)

  console.log('✅ Returning', transformedSuggestions.length, 'advanced suggestions')
  console.log('📊 Top suggestion scores:', transformedSuggestions.slice(0, 3).map(s => s?.score))

  return res.status(200).json({ suggestions: transformedSuggestions })
}

function getYearSuffix(year: number): string {
  if (year === 1) return 'st'
  if (year === 2) return 'nd'
  if (year === 3) return 'rd'
  return 'th'
}
