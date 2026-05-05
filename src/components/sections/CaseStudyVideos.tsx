import {
  caseStudyVideos,
  type CaseStudyVideo,
} from "@/lib/content/case-studies";

export function CaseStudyVideos() {
  return (
    <section className="px-6 py-16 lg:px-10 lg:py-20">
      <ul className="mx-auto grid max-w-[1400px] gap-8 sm:grid-cols-2 lg:grid-cols-4">
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
    <article className="bg-brand-50/40 ring-brand-100/60 flex flex-col gap-4 rounded-3xl p-5 text-left shadow-sm ring-1">
      <video
        controls
        preload="none"
        poster={video.posterUrl}
        className="aspect-video w-full rounded-2xl bg-slate-100 object-contain"
        aria-label={`Video case study from ${video.name}`}
      >
        <source src={video.videoUrl} type="video/mp4" />
      </video>
      <header>
        <h3 className="text-brand-600 text-base font-semibold">{video.name}</h3>
        <p className="text-sm text-slate-500">{video.role}</p>
      </header>
    </article>
  );
}
