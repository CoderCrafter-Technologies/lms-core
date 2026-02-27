export default function ClassroomLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="h-screen overflow-hidden bg-gray-900">
      {children}
    </div>
  )
}
