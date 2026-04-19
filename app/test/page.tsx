'use client'
import { Pagination } from '@/components/dashboard/Pagination'
import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'

const limit = 20

function usePokemon(page: number) {
  const [data, setData] = useState<any>(null)
  const cache = useRef<{ [key: number]: any }>({})
  useEffect(() => {
    const fetchData = async () => {
      if (cache.current[page]) {
        setData(cache.current[page])
        return
      }
      const offset = (page - 1) * limit
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${limit}&offset=${offset}`)
      const result = await res.json()
      cache.current[page] = result
      setData(result)
    }
    fetchData()
  }, [page])

  return data
}

export default function Test() {
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const detailCache = useRef<{ [key: string]: any }>({})
  const data = usePokemon(page)

  useEffect(() => {
    if (selected && dialogRef.current) {
      dialogRef.current.showModal()
    } else if (dialogRef.current) {
      dialogRef.current.close()
    }
  }, [selected])
  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase()
    return data?.results?.filter((p: any) =>
      p.name.toLowerCase().includes(term)
    ) || []
  }, [data, searchTerm])

  const fetchDetails = async (url: string) => {
    if (detailCache.current[url]) {
      setSelected(detailCache.current[url])
      return
    }
    const res = await fetch(url)
    const result = await res.json()
    detailCache.current[url] = result
    setSelected(result)
  }

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>Pokemon List</h1>
      <input placeholder="Search Pokemon..." onChange={e => setSearchTerm(e.target.value)} style={{ padding: 10, border: '1px solid #ccc', marginBottom: 20 }} />
      {!data && <p>Loading...</p>}
      {data && filtered.length === 0 && <p>No Pokemon match your search.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(500px, 1fr))', gap: 20 }}>
        {filtered.map((p: any) => (
          <button key={p.name} onClick={() => fetchDetails(p.url)} style={{ border: '1px solid #ccc', padding: 10, cursor: 'pointer', background: 'none', textAlign: 'left' }}>
            <h2 style={{ textTransform: 'uppercase' }}>{p.name}</h2>
            <p>{p.url}</p>
          </button>
        ))}
      </div>
      {selected && (
        <>
          <div className="pokemon-backdrop" aria-hidden="true" />
          <dialog ref={dialogRef} className="pokemon-dialog" onClose={() => setSelected(null)} onCancel={() => setSelected(null)}>
            <h2>{selected.name.toUpperCase()}</h2>
            <Image src={selected.sprites.front_default} alt={selected.name} width={200} height={200} />
            <p><strong>ID:</strong> {selected.id}</p>
            <p><strong>Height:</strong> {selected.height}</p>
            <p><strong>Weight:</strong> {selected.weight}</p>
            <p><strong>Types:</strong> {selected.types.map((t: any) => t.type.name).join(', ')}</p>
            <button onClick={() => setSelected(null)} style={{ marginTop: 10, padding: '5px 10px', cursor: 'pointer' }}>Close</button>
          </dialog>
        </>
      )}
      <button onClick={() => location.reload()} style={{ marginTop: 20, marginBottom: 20, padding: '10px 20px', backgroundColor: '#f59e0b' }}>
        Refresh
      </button>
      <Pagination page={page} totalPages={data?.count ? Math.ceil(data.count / limit) : 0} onPageChange={setPage} />
    </div>
  )
}