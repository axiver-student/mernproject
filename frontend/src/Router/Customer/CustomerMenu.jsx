import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { addToCart, setTableToken } from '../../store/slices/cartSlice'
import {
  fetchMenuItems,
  fetchCategories,
  setSearchFilter,
  setCategoryFilter
} from '../../store/slices/menuSlice'

import { useSearchParams } from 'react-router-dom'
import tableService from '../../services/tableService'

const CustomerMenu = () => {
  const dispatch = useDispatch()
  const { items: menuItems, categories, loading, error, lastUpdated } = useSelector((state) => state.menu)
  const [searchParams] = useSearchParams() // ← ADD THIS
  const tableSlug = searchParams.get('table') // ← ADD THIS
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')

  const [table, setTable] = useState(null)
  const [tableLoading, setTableLoading] = useState(false)
  const [tableError, setTableError] = useState(null)

  // ← ADD THIS EFFECT (Place BEFORE existing useEffect)
  useEffect(() => {
    const fetchTable = async () => {
      if (!tableSlug) {
        // No table specified - allow browsing without table
        console.log('No table specified, showing menu anyway')
        return
      }

      try {
        setTableLoading(true)
        const tableData = await tableService.getTableBySlug(tableSlug)

        if (tableData.occupied) {
          setTableError('This table is currently occupied. Please ask staff for assistance.')
          return
        }

        setTable(tableData)
        // Persist table token (use the table's _id so backend can accept as tableId)
        try {
          dispatch(setTableToken(tableData._id))
        } catch (err) {
          console.warn('Failed to set table token in store', err)
        }
        setTableError(null)
      } catch (err) {
        console.error('Error fetching table:', err)
        setTableError(err.message || 'Failed to load table information')
      } finally {
        setTableLoading(false)
      }
    }

    fetchTable()
  }, [tableSlug])

  useEffect(() => {
    dispatch(fetchCategories())
    dispatch(fetchMenuItems({ limit: 100 }))
  }, [dispatch])

  const handleSearch = (e) => {
    const val = e.target.value
    setSearch(val)
  }

  const applyFilters = () => {
    const opts = { limit: 100 }
    if (search) opts.search = search
    if (selectedCategory) opts.categoryId = selectedCategory
    dispatch(fetchMenuItems(opts))
  }

  useEffect(() => {
    // apply filters when selectedCategory changes
    applyFilters()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory])

  const handleAddToCart = (item) => {
    if (!item.availability && item.availability !== undefined) {
      alert('Item is currently unavailable')
      return
    }

    const id = item.id || item._id
    dispatch(addToCart({ id, name: item.name, price: item.price, quantity: 1 }))
    // optionally show a toast - for now a small confirmation
    // eslint-disable-next-line no-undef
    try { window.alert(`${item.name} added to cart`) } catch (_) { }
  }

  if (loading || tableLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-800 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading menu...</p>
        </div>
      </div>
    )
  }

  if (tableError) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Table Unavailable</h2>
          <p className="text-gray-600 mb-6">{tableError}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all"
          >
            Go to Home
          </button>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-semibold">Error loading menu</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={() => dispatch(fetchMenuItems({ limit: 100 }))}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }
  // Apply category filter on the frontend
  const filteredItems = menuItems.filter((item) => {
    // match category
    const matchesCategory =
      selectedCategory === '' ||
      item.category?.id === selectedCategory ||
      item.category?._id === selectedCategory

    // match search (optional)
    const matchesSearch =
      search === '' ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.tags?.some((tag) => tag.toLowerCase().includes(search.toLowerCase()))

    return matchesCategory && matchesSearch
  })


  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-green-50 to-yellow-50">
      {/* Table Info Banner */}
      {table && (
        <div className="bg-gradient-to-r from-yellow-100 to-green-100 border-b border-yellow-200 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-3xl">🍽️</div>
              <div>
                <h2 className="text-xl font-bold text-yellow-900" style={{ fontFamily: 'Playfair Display, serif' }}>
                  Table {table.number}
                </h2>
                <p className="text-sm text-yellow-700" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  Your orders will be associated with this table
                </p>
              </div>
            </div>
            <div className="bg-green-100 px-4 py-2 rounded-full border border-green-200">
              <span className="text-green-800 font-semibold text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>✓ Available</span>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-800 mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
            Our Menu
          </h1>
          <p className="text-xl text-gray-600 mb-8" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Discover exquisite flavors crafted with passion
          </p>

          {/* Search Bar */}
          <div className="max-w-md mx-auto flex gap-3">
            <input
              value={search}
              onChange={handleSearch}
              placeholder="Search for dishes..."
              className="flex-1 px-6 py-3 border-2 border-yellow-200 rounded-full focus:outline-none focus:border-yellow-400 transition-colors"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            />
            <button
              onClick={applyFilters}
              className="px-8 py-3 bg-yellow-600 text-white rounded-full hover:bg-yellow-700 transition-all duration-300 transform hover:scale-105 shadow-lg"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Search
            </button>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex justify-center mb-12">
          <div className="flex gap-4 flex-wrap justify-center">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-6 py-3 rounded-full font-semibold transition-all duration-300 transform hover:scale-105 ${
                selectedCategory === ''
                  ? 'bg-yellow-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-yellow-50 border-2 border-yellow-200'
              }`}
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              All Categories
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id || cat._id}
                onClick={() => setSelectedCategory(cat.id || cat._id)}
                className={`px-6 py-3 rounded-full font-semibold transition-all duration-300 transform hover:scale-105 ${
                  selectedCategory === (cat.id || cat._id)
                    ? 'bg-yellow-600 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-yellow-50 border-2 border-yellow-200'
                }`}
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Items Grid */}
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-xl p-16 text-center">
            <div className="text-6xl mb-6">🍽️</div>
            <h3 className="text-3xl font-bold text-gray-800 mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>No items found</h3>
            <p className="text-lg text-gray-600" style={{ fontFamily: 'Poppins, sans-serif' }}>Try a different category or search term.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredItems.map((item) => (
              <div
                key={item.id || item._id}
                className="bg-white rounded-3xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 group"
              >
                <div className="h-56 bg-gradient-to-br from-yellow-100 to-green-100 flex items-center justify-center relative overflow-hidden">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="text-6xl text-yellow-300">🍽️</div>
                  )}
                  <div className="absolute top-4 right-4">
                    <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                      item.availability
                        ? 'bg-green-100 text-green-800 border border-green-200'
                        : 'bg-red-100 text-red-800 border border-red-200'
                    }`}>
                      {item.availability ? '✓ Available' : '✗ Unavailable'}
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                    {item.name}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {item.description}
                  </p>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-3xl font-bold text-yellow-600" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      ₹{item.price}
                    </span>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleAddToCart(item)}
                      disabled={!item.availability}
                      className={`flex-1 py-3 text-sm font-bold rounded-full transition-all duration-300 transform hover:scale-105 ${
                        item.availability
                          ? 'bg-yellow-600 text-white hover:bg-yellow-700 shadow-lg'
                          : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      }`}
                      style={{ fontFamily: 'Poppins, sans-serif' }}
                    >
                      Add to Cart
                    </button>

                    <a
                      href={`/customer/item/${item.id || item._id}`}
                      className="px-4 py-3 bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-all duration-300 transform hover:scale-105"
                      style={{ fontFamily: 'Poppins, sans-serif' }}
                    >
                      View
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


export default CustomerMenu