'use client'

export default function LayoutTestPage() {
  return (
    <div className="h-screen flex bg-gray-100">
      {/* Test Sidebar */}
      <div className="w-64 bg-blue-600 text-white p-4 flex-shrink-0">
        <h2 className="text-xl font-bold mb-4">Sidebar</h2>
        <div className="space-y-2">
          <div className="p-2 bg-blue-700 rounded">Nav Item 1</div>
          <div className="p-2 bg-blue-700 rounded">Nav Item 2</div>
          <div className="p-2 bg-blue-700 rounded">Nav Item 3</div>
        </div>
      </div>
      
      {/* Test Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-16 bg-white border-b border-gray-200 flex items-center px-6 flex-shrink-0">
          <h1 className="text-xl font-semibold">Header Area</h1>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4">Layout Test</h2>
            <p className="mb-4">This tests the layout structure:</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-blue-100 p-4 rounded">
                <h3 className="font-semibold">Box 1</h3>
                <p>Content should be properly positioned</p>
              </div>
              <div className="bg-green-100 p-4 rounded">
                <h3 className="font-semibold">Box 2</h3>
                <p>Next to the sidebar, not below it</p>
              </div>
              <div className="bg-purple-100 p-4 rounded">
                <h3 className="font-semibold">Box 3</h3>
                <p>Flexbox layout working correctly</p>
              </div>
            </div>
            
            {/* Test scrolling with lots of content */}
            <div className="space-y-4">
              {[...Array(20)].map((_, i) => (
                <div key={i} className="bg-gray-100 p-4 rounded">
                  <h4 className="font-medium">Content Block {i + 1}</h4>
                  <p>This content should scroll within the main area without affecting the sidebar position.</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}