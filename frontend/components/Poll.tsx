// components/Poll.tsx
'use client'

import { Button } from './ui/button'
import { Progress } from './ui/progress'

interface PollProps {
  poll: {
    id: string
    question: string
    options: string[]
    votes: Record<string, number | string>
  }
  onVote: (option: string) => void
  userId: string
}

export default function Poll({ poll, onVote, userId }: PollProps) {
  const totalVotes = Object.values(poll.votes).reduce<number>(
    (sum, count) => sum + (typeof count === 'number' ? count : 0),
    0
  )
  const userVoted = poll.votes[userId] !== undefined
  const selectedOption = typeof poll.votes[userId] === 'string' ? String(poll.votes[userId]) : undefined

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-sm mb-2">{poll.question}</h4>
      
      {poll.options.map((option) => {
        const voteCount = typeof poll.votes[option] === 'number' ? Number(poll.votes[option]) : 0
        const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0
        
        return (
          <div key={option} className="space-y-1">
            <Button
              variant={userVoted ? (selectedOption === option ? 'default' : 'outline') : 'outline'}
              className="w-full justify-start"
              onClick={() => !userVoted && onVote(option)}
              disabled={userVoted}
            >
              {option}
              {userVoted && (
                <span className="ml-auto text-sm">
                  {percentage}%
                </span>
              )}
            </Button>
            {userVoted && (
              <Progress value={percentage} className="h-2" />
            )}
          </div>
        )
      })}
      
      <div className="text-xs text-gray-400 text-right">
        {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
