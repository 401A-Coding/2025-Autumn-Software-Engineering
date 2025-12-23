import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ScrollToTop() {
    const location = useLocation()

    useEffect(() => {
        // Reset document scroll position on route change
        window.scrollTo(0, 0)
    }, [location.pathname, location.search, location.hash])

    return null
}
