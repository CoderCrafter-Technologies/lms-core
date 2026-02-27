import * as React from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DateTimePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  className?: string;
}

export function DateTimePicker({
  date,
  setDate,
  className,
}: DateTimePickerProps) {
  const [time, setTime] = React.useState<string>(
    date ? format(date, "HH:mm") : "00:00"
  );
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (date && time) {
      const [hours, minutes] = time.split(":").map(Number);
      const newDate = new Date(date);
      newDate.setHours(hours);
      newDate.setMinutes(minutes);
      setDate(newDate);
    }
  }, [time, date, setDate]);

  const handleTimeChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const timeValue = e.target.value;
    if (timeValue.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
      setTime(timeValue);
    }
  };

  const handleSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    if (selectedDate && time) {
      const [hours, minutes] = time.split(":").map(Number);
      selectedDate.setHours(hours);
      selectedDate.setMinutes(minutes);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
          {date ? (
            <span style={{ color: 'var(--color-text)' }}>{format(date, "PPP HH:mm")}</span>
          ) : (
            <span style={{ color: 'var(--color-text-secondary)' }}>Pick a date and time</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-0" 
        align="start"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
        />
        <div className="p-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <Input
              type="time"
              value={time}
              onChange={handleTimeChange}
              className="w-[120px]"
            />
            <Select
              value={date?.getHours() >= 12 ? "PM" : "AM"}
              onValueChange={(value) => {
                if (date && time) {
                  const [hours, minutes] = time.split(":").map(Number);
                  let newHours = hours;
                  if (value === "AM" && hours >= 12) {
                    newHours = hours - 12;
                  } else if (value === "PM" && hours < 12) {
                    newHours = hours + 12;
                  }
                  const newTime = `${newHours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
                  setTime(newTime);
                  
                  const newDate = new Date(date);
                  newDate.setHours(newHours);
                  newDate.setMinutes(minutes);
                  setDate(newDate);
                }
              }}
            >
              <SelectTrigger className="w-[70px]">
                <SelectValue placeholder="AM" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AM">AM</SelectItem>
                <SelectItem value="PM">PM</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
