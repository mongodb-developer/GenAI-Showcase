import { Badge } from "@/components/ui/badge"

interface TagProps {
  name: string;
}

export function Tag({ name }: TagProps) {
  return (
    <Badge variant="secondary" className="mr-1 mb-1">
      {name}
    </Badge>
  )
}

