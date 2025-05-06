// ES6 Modular JavaScript. 
import { TrackJS } from 'trackjs';

// Only initialize in browser environment, not during server-side rendering
if (typeof window !== 'undefined') {
  TrackJS.install({
    token: "2718ca1ab72d4ff38899696b48210d39"
    // for more configuration options, see https://docs.trackjs.com
  });
}

export default TrackJS; 