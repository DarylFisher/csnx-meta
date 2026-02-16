import { useNavigate } from "react-router-dom";

const cards = [
  {
    title: "Overall Status",
    description:
      "View a high-level summary of development progress across all active projects and initiatives.",
    path: "/development/overall",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    title: "Customer Project Status",
    description:
      "Track the progress of customer-specific development projects, milestones, and deliverables.",
    path: "/development/customer",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
];

export default function DevelopmentStatus() {
  const navigate = useNavigate();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Development Status</h1>
      <p className="text-gray-500 mb-6">
        Monitor development progress and track project milestones.
      </p>
      <div className="grid md:grid-cols-2 gap-6">
        {cards.map((card) => (
          <button
            key={card.path}
            onClick={() => navigate(card.path)}
            className="text-left border rounded-xl p-6 hover:shadow-lg hover:border-blue-300 transition group"
          >
            <div className="text-blue-700 mb-3 group-hover:text-blue-500 transition-colors">
              {card.icon}
            </div>
            <h2 className="text-lg font-semibold mb-2">{card.title}</h2>
            <p className="text-sm text-gray-500">{card.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
