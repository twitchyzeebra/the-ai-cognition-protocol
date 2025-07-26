# Netlify Development Server - 30-Second Timeout Fix

## The Problem
The Netlify CLI uses `lambda-local` which has a **hardcoded 30-second timeout** that cannot be overridden through configuration. This affects local development only - production works fine with longer timeouts.

## The Solutions Implemented

### Solution 1: Smart Timeout Handling (Primary Fix)
The chat function now:
- **Detects local development** vs production environment
- **Uses 25-second timeout** in local dev (before lambda-local kills it)
- **Uses 10-minute timeout** in production
- **Returns partial response** in local dev if timeout occurs instead of error

### Solution 2: Lambda-Local Patching (Advanced)
```bash
npm run dev
```
This script attempts to:
1. **Locate the lambda-local module** in netlify-cli dependencies
2. **Patch the hardcoded 30000ms** to 600000ms (10 minutes)
3. **Automatically patch** when starting dev server

### Solution 3: Environment Variables (Fallback)
```powershell
$env:NETLIFY_LAMBDA_TIMEOUT='600'; $env:LAMBDA_TIMEOUT='600000'; netlify dev
```

## Current Behavior

### Local Development (25-second limit)
- ✅ **Short responses**: Complete normally
- ✅ **Medium responses**: Complete if under 25 seconds
- ⚠️ **Long responses**: Return partial response with timeout notice
- 📋 **User experience**: Clear messaging about local vs production behavior

### Production Deployment (10-minute limit)
- ✅ **All responses**: Full 10-minute timeout available
- ✅ **Complex prompts**: Process completely without interruption

## Testing the Fix

1. **Start development server**: `npm run dev`
2. **Send complex prompt**: Should get response or clear timeout message
3. **Check console**: Will show which timeout mode is active
4. **Deploy to production**: Full responses work without timeout issues

## Current Configuration

- **Local development**: 25-second timeout with graceful handling
- **Production**: 10-minute timeout via netlify.toml
- **Fallback responses**: User-friendly partial content messages
- **Environment detection**: Automatic local vs production detection

## Notes

- **The 30-second limit is unfixable** in lambda-local module without patching
- **Production deployments** work perfectly with full 10-minute timeouts
- **Local development** now provides graceful degradation instead of hard errors
- **Patch method** attempts to fix the root cause by modifying lambda-local
- **Users get clear feedback** about local limitations vs production capabilities

## Recommendation

**For development**: Use `npm run dev` and expect 25-second responses with graceful fallbacks  
**For testing long responses**: Deploy to Netlify staging/production where full timeouts work  
**For production**: Full 10-minute timeouts work as configured
