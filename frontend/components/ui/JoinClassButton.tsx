import { Button, ButtonProps } from "@/components/ui/button";
import { Play, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface JoinClassButtonProps extends ButtonProps {
  roomId: string;
  isLive?: boolean;
  classTitle?: string;
  onBeforeJoin?: () => Promise<boolean> | boolean;
}

export default function JoinClassButton({
  roomId,
  isLive = false,
  classTitle,
  onBeforeJoin,
  children,
  ...props
}: JoinClassButtonProps) {
  const router = useRouter();

  const handleJoinClass = async () => {
    try {
      // Run pre-join checks if provided
      if (onBeforeJoin) {
        const canJoin = await onBeforeJoin();
        if (!canJoin) {
          toast.error("Unable to join class at this time");
          return;
        }
      }

      // Here you could add additional checks
      // - Verify user permissions
      // - Check if class is actually live/available
      // - Validate room ID format
      
      if (!roomId) {
        toast.error("Invalid class room ID");
        return;
      }

      // Navigate to the class room
      router.push(`/classroom/${roomId}`);
      
      // Show success message with appropriate styling
      toast.success(
        <div className="flex items-center gap-2">
          <span>✨</span>
          <span>
            {isLive 
              ? "Joining live class..." 
              : classTitle 
                ? `Starting "${classTitle}"...` 
                : "Starting class session..."
            }
          </span>
        </div>,
        {
          style: {
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)'
          }
        }
      );
    } catch (error) {
      console.error("Failed to join class:", error);
      toast.error(
        <div className="flex items-center gap-2">
          <span>❌</span>
          <span>Failed to join class. Please try again.</span>
        </div>,
        {
          style: {
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)'
          }
        }
      );
    }
  };

  const getButtonVariant = () => {
    if (isLive) return "success";
    return "default";
  };

  const getButtonText = () => {
    if (children) return children;
    if (isLive) return "Join Live";
    return "Start Class";
  };

  return (
    <Button
      onClick={handleJoinClass}
      variant={getButtonVariant()}
      className="gap-2"
      {...props}
    >
      {isLive ? (
        <Play className="w-4 h-4" style={{ color: 'currentColor' }} />
      ) : (
        <Clock className="w-4 h-4" style={{ color: 'currentColor' }} />
      )}
      {getButtonText()}
    </Button>
  );
}