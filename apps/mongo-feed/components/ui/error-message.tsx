interface ErrorMessageProps {
  message: string
}

export function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div className="p-4 text-center text-red-500">
      <p>{message}</p>
    </div>
  )
}
