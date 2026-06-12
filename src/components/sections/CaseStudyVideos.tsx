import {
  caseStudySectionHeadings,
  caseStudyVideos,
  type CaseStudyVideo,
} from "@/lib/content/case-studies";

export function CaseStudyVideos() {
  return (
    <section className="bg-[#f5fbff] px-5 py-16 lg:px-10 lg:py-20">
      <h2 className="sr-only">{caseStudySectionHeadings.videos}</h2>
      <ul className="mx-auto grid max-w-[1500px] gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {caseStudyVideos.map((video) => (
          <li key={video.id}>
            <VideoCard video={video} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function VideoCard({ video }: { video: CaseStudyVideo }) {
  return (
    <article className="flex h-full flex-col gap-4 rounded-[10px] border-2 border-[#111111] bg-white p-5 text-left shadow-[7px_7px_0_#55b8e8]">
      <video
        controls
        preload="none"
        poster={video.posterUrl}
        className="aspect-video w-full rounded-[8px] border-2 border-[#111111] bg-slate-100 object-contain focus-visible:ring-4 focus-visible:ring-[#066a99] focus-visible:ring-offset-2 focus-visible:outline-none"
        aria-label={`Video case study from ${video.name}`}
      >
        <source src={video.videoUrl} type="video/mp4" />
      </video>
      <header>
        <h3 className="text-base font-black text-[#111111] uppercase">
          {video.name}
        </h3>
        <p className="text-sm font-semibold text-slate-600">{video.role}</p>
      </header>
    </article>
  );
}
